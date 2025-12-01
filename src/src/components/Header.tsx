import { ConnectButton } from '@rainbow-me/rainbowkit';

export function Header() {
  return (
    <header className="hero">
      <div className="hero__titles">
        <p className="eyebrow">Hidden Liquidity · Sepolia</p>
        <h1>Confidential cUSDC</h1>
        <p className="lede">
          Swap ETH into encrypted cUSDC, decrypt balances on demand, and push pooled liquidity through the Uniswap v2
          router without revealing amounts.
        </p>
        <div className="hero__badges">
          <span className="pill">1 ETH = 3100 cUSDC</span>
          <span className="pill pill--ghost">Router: Uniswap v2</span>
        </div>
      </div>
      <div className="hero__cta">
        <ConnectButton />
      </div>
    </header>
  );
}
