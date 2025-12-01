import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Hidden Liquidity',
  projectId: 'd5d6b1c5f48c4b27a3c5c1d7e8f5b9a2',
  chains: [sepolia],
  ssr: false,
});
