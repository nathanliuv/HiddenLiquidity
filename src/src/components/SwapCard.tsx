import { useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { useAccount, useReadContract } from 'wagmi';
import { CUSDC_ADDRESS, HAS_DEPLOYMENT, SWAP_ABI, SWAP_ADDRESS } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';

const DECIMALS = 1_000_000n;

function formatCusdc(amount?: bigint | null) {
  if (!amount) return '0.000';
  return (Number(amount) / Number(DECIMALS)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

export function SwapCard() {
  const { address } = useAccount();
  const signerPromise = useEthersSigner();
  const [ethValue, setEthValue] = useState('0.1');
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const parsedEth = useMemo(() => {
    try {
      const wei = ethers.parseEther(ethValue || '0');
      return wei > 0n ? wei : null;
    } catch {
      return null;
    }
  }, [ethValue]);

  const { data: previewAmount } = useReadContract({
    address: SWAP_ADDRESS as `0x${string}`,
    abi: SWAP_ABI,
    functionName: 'previewCusdc',
    args: parsedEth ? [parsedEth] : undefined,
    query: { enabled: !!parsedEth && HAS_DEPLOYMENT },
  });

  const executeSwap = async () => {
    if (!signerPromise) {
      setStatus('Connect your wallet first.');
      return;
    }

    if (!HAS_DEPLOYMENT) {
      setStatus('Contracts are not deployed yet.');
      return;
    }

    if (!parsedEth) {
      setStatus('Enter a valid ETH amount.');
      return;
    }

    setIsSubmitting(true);
    setStatus('Submitting swap...');
    setTxHash(null);
    try {
      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet unavailable');
      }

      const contract = new ethers.Contract(SWAP_ADDRESS, SWAP_ABI, signer);
      const tx = await contract.swapEthForCusdc(address, { value: parsedEth });
      setStatus('Waiting for confirmation...');
      const receipt = await tx.wait();
      setTxHash(receipt?.hash ?? tx.hash);
      setStatus('Swap confirmed.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Swap failed';
      setStatus(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div className="card__header">
        <div>
          <p className="eyebrow">Swap</p>
          <h3>ETH → cUSDC</h3>
        </div>
        {!HAS_DEPLOYMENT && <span className="pill pill--warning">Awaiting deployment</span>}
      </div>

      <label className="label" htmlFor="swap-eth">
        Pay (ETH)
      </label>
      <input
        id="swap-eth"
        className="input"
        value={ethValue}
        onChange={(e) => setEthValue(e.target.value)}
        placeholder="0.10"
        inputMode="decimal"
      />
      <div className="muted small">Value is sent directly to the swap contract.</div>

      <div className="preview-row">
        <div>
          <p className="label">You will receive</p>
          <p className="figure">{formatCusdc(previewAmount as bigint)}</p>
          <p className="muted">cUSDC (6 decimals) minted to your address</p>
        </div>
        <div className="actions">
          <button className="button" onClick={executeSwap} disabled={isSubmitting || !HAS_DEPLOYMENT || !parsedEth}>
            {isSubmitting ? 'Processing...' : 'Swap now'}
          </button>
          {status && <p className="muted small">{status}</p>}
          {txHash && (
            <a className="link small" href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">
              View on Etherscan
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
