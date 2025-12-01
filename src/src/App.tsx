import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import './App.css';

import { config } from './config/wagmi';
import { BalancePanel } from './components/BalancePanel';
import { Header } from './components/Header';
import { LiquidityCard } from './components/LiquidityCard';
import { SwapCard } from './components/SwapCard';

const queryClient = new QueryClient();

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider locale="en">
          <div className="app-shell">
            <Header />
            <div className="grid">
              <div className="grid__col-span-2">
                <SwapCard />
              </div>
              <BalancePanel />
              <LiquidityCard />
            </div>
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App
