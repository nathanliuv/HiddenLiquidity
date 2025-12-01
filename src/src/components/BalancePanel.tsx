import { useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { CUSDC_ABI, CUSDC_ADDRESS, HAS_DEPLOYMENT } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';

const DECIMALS = 1_000_000n;

function formatUnits(amount?: bigint | null) {
  if (!amount) return '0.000000';
  return (Number(amount) / Number(DECIMALS)).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 6 });
}

export function BalancePanel() {
  const { address } = useAccount();
  const { instance, isLoading: zamaLoading } = useZamaInstance();
  const signerPromise = useEthersSigner();
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: encryptedBalance } = useReadContract({
    address: CUSDC_ADDRESS as `0x${string}`,
    abi: CUSDC_ABI,
    functionName: 'confidentialBalanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && HAS_DEPLOYMENT },
  });

  const { data: clearBalance } = useReadContract({
    address: CUSDC_ADDRESS as `0x${string}`,
    abi: CUSDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && HAS_DEPLOYMENT },
  });

  useEffect(() => {
    setDecrypted(null);
    setError(null);
  }, [address]);

  const handleDecrypt = async () => {
    if (!instance || !address || !encryptedBalance || !signerPromise) {
      setError('Wallet, encryption service, and ciphertext are all required');
      return;
    }

    setDecrypting(true);
    setError(null);
    try {
      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        {
          handle: encryptedBalance as string,
          contractAddress: CUSDC_ADDRESS,
        },
      ];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CUSDC_ADDRESS];
      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signer = await signerPromise;

      if (!signer) {
        throw new Error('Connect wallet to decrypt');
      }

      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const raw = result[encryptedBalance as string] || '0';
      setDecrypted(raw.toString());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to decrypt balance';
      setError(message);
    } finally {
      setDecrypting(false);
    }
  };

  const decryptedDisplay = useMemo(() => {
    if (!decrypted) return null;
    try {
      return formatUnits(BigInt(decrypted));
    } catch {
      return decrypted;
    }
  }, [decrypted]);

  const encryptedHandle = encryptedBalance ? String(encryptedBalance) : '';

  return (
    <div className="card">
      <div className="card__header">
        <div>
          <p className="eyebrow">Encrypted balance</p>
          <h3>cUSDC vault</h3>
        </div>
        {!HAS_DEPLOYMENT && <span className="pill pill--warning">Deploy contracts to activate</span>}
      </div>

      {!address && <p className="muted">Connect your wallet to inspect balances.</p>}

      {address && (
        <>
          <div className="balance-row">
            <div>
              <p className="label">Public balance</p>
              <p className="figure">{formatUnits(clearBalance as bigint)}</p>
              <p className="muted">Always-on ERC20 balance (6 decimals)</p>
            </div>
            <div>
              <p className="label">Encrypted handle</p>
              <p className="handle">{encryptedHandle ? `${encryptedHandle.slice(0, 18)}...` : '—'}</p>
              <p className="muted">Decrypt locally via Zama relayer</p>
            </div>
          </div>

          <div className="decrypt-row">
            <div>
              <p className="label">Decrypted amount</p>
              <p className="figure">{decryptedDisplay ?? 'Hidden'}</p>
              <p className="muted">Stays client-side; requires wallet signature</p>
            </div>
            <div className="actions">
              <button
                className="button"
                onClick={handleDecrypt}
                disabled={!HAS_DEPLOYMENT || !encryptedBalance || decrypting || zamaLoading}
              >
                {decrypting ? 'Decrypting...' : 'Decrypt with Zama'}
              </button>
              {error && <p className="error">{error}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
