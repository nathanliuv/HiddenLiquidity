import { useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { useAccount, useReadContract } from 'wagmi';
import { CUSDC_ABI, CUSDC_ADDRESS, HAS_DEPLOYMENT, SWAP_ABI, SWAP_ADDRESS } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';

const CUSDC_DECIMALS = 6;

function formatAmount(amount?: bigint | null) {
  if (!amount) return '0.00';
  return (Number(amount) / Number(10n ** BigInt(CUSDC_DECIMALS))).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

export function LiquidityCard() {
  const { address } = useAccount();
  const signerPromise = useEthersSigner();
  const [cusdcValue, setCusdcValue] = useState('100');
  const [ethValue, setEthValue] = useState('0.2');
  const [status, setStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const desiredCusdc = useMemo(() => {
    try {
      const parsed = ethers.parseUnits(cusdcValue || '0', CUSDC_DECIMALS);
      return parsed > 0n ? parsed : null;
    } catch {
      return null;
    }
  }, [cusdcValue]);

  const desiredEth = useMemo(() => {
    try {
      const parsed = ethers.parseEther(ethValue || '0');
      return parsed > 0n ? parsed : null;
    } catch {
      return null;
    }
  }, [ethValue]);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CUSDC_ADDRESS as `0x${string}`,
    abi: CUSDC_ABI,
    functionName: 'allowance',
    args: address ? [address, SWAP_ADDRESS] : undefined,
    query: { enabled: !!address && HAS_DEPLOYMENT },
  });

  const needsApproval = useMemo(() => {
    if (!desiredCusdc || allowance === undefined || allowance === null) return true;
    return allowance < desiredCusdc;
  }, [allowance, desiredCusdc]);

  const approveTokens = async () => {
    if (!signerPromise) {
      setStatus('Connect your wallet first.');
      return;
    }
    if (!desiredCusdc) {
      setStatus('Enter a cUSDC amount.');
      return;
    }
    setIsApproving(true);
    setStatus('Sending approval...');
    try {
      const signer = await signerPromise;
      if (!signer) throw new Error('Wallet unavailable');
      const token = new ethers.Contract(CUSDC_ADDRESS, CUSDC_ABI, signer);
      const tx = await token.approve(SWAP_ADDRESS, desiredCusdc);
      const receipt = await tx.wait();
      setTxHash(receipt?.hash ?? tx.hash);
      setStatus('Approval confirmed.');
      await refetchAllowance();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Approval failed';
      setStatus(message);
    } finally {
      setIsApproving(false);
    }
  };

  const addLiquidity = async () => {
    if (!signerPromise) {
      setStatus('Connect your wallet first.');
      return;
    }
    if (!desiredCusdc || !desiredEth) {
      setStatus('Enter token amounts.');
      return;
    }
    setIsAdding(true);
    setStatus('Adding liquidity...');
    setTxHash(null);
    try {
      const signer = await signerPromise;
      if (!signer) throw new Error('Wallet unavailable');
      const contract = new ethers.Contract(SWAP_ADDRESS, SWAP_ABI, signer);
      const deadline = Math.floor(Date.now() / 1000) + 900;
      const minCusdc = (desiredCusdc * 99n) / 100n;
      const minEth = (desiredEth * 99n) / 100n;

      const tx = await contract.addLiquidity(desiredCusdc, minCusdc, minEth, deadline, address, { value: desiredEth });
      const receipt = await tx.wait();
      setTxHash(receipt?.hash ?? tx.hash);
      setStatus('Liquidity added.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Add liquidity failed';
      setStatus(message);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="card">
      <div className="card__header">
        <div>
          <p className="eyebrow">Liquidity</p>
          <h3>Uniswap v2 helper</h3>
        </div>
        {!HAS_DEPLOYMENT && <span className="pill pill--warning">Awaiting deployment</span>}
      </div>

      <div className="input-row">
        <div className="input-block">
          <label className="label" htmlFor="cusdc-amount">
            cUSDC amount
          </label>
          <input
            id="cusdc-amount"
            className="input"
            value={cusdcValue}
            onChange={(e) => setCusdcValue(e.target.value)}
            placeholder="250.0"
            inputMode="decimal"
          />
        </div>
        <div className="input-block">
          <label className="label" htmlFor="eth-amount">
            ETH to pair
          </label>
          <input
            id="eth-amount"
            className="input"
            value={ethValue}
            onChange={(e) => setEthValue(e.target.value)}
            placeholder="0.20"
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="preview-row">
        <div>
          <p className="label">Minimums (1% buffer)</p>
          <p className="muted">
            {formatAmount(desiredCusdc ? (desiredCusdc * 99n) / 100n : null)} cUSDC ·{' '}
            {desiredEth ? (Number(desiredEth) / 1e18 * 0.99).toFixed(4) : '0'} ETH
          </p>
        </div>
        <div className="actions">
          <button
            className="button button--ghost"
            onClick={approveTokens}
            disabled={!needsApproval || isApproving || !HAS_DEPLOYMENT || !desiredCusdc}
          >
            {isApproving ? 'Approving...' : needsApproval ? 'Approve cUSDC' : 'Approved'}
          </button>
          <button
            className="button"
            onClick={addLiquidity}
            disabled={needsApproval || isAdding || !HAS_DEPLOYMENT || !desiredCusdc || !desiredEth}
          >
            {isAdding ? 'Adding...' : 'Add liquidity'}
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
