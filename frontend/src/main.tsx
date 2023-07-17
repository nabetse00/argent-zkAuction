import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

import {
  createHashRouter,
  RouterProvider,
} from "react-router-dom";
import ErrorPage from './views/ErrorPage.tsx';
import AddAuction from './views/AddAuction.tsx';

import { Web3OnboardProvider, init} from '@web3-onboard/react'
import argentModule from "@web3-onboard/argent";
import injectedModule from '@web3-onboard/injected-wallets'
import AuctionsView from './views/AuctionsView.tsx';
import Contracts from './views/Contracts.tsx';

const BASE = '/'

const router = createHashRouter([
  {
    path: `${BASE}`,
    element: <App />,
    errorElement: <ErrorPage />,
    children: [{
      path: `${BASE}`,
      element: <AddAuction />,
    }, {
      path: `${BASE}create-auction`,
      element: <AddAuction />,
    },
    {
      path: `${BASE}auctions`,
      element: <AuctionsView />,
    },
    {
      path: `${BASE}contracts`,
      element: <Contracts />,
    },
    ]
  },
]);

const USDC_LOCAL = import.meta.env.VITE_USDC_LOCAL
const DAI_LOCAL = import.meta.env.VITE_DAI_LOCAL
const USDC = import.meta.env.VITE_USDC
const DAI = import.meta.env.VITE_DAI

const appMetadata = {
  name: "zkAuction",
  icon: "https://lite.zksync.io/images/logo-no-letters.svg",
  logo: "https://lite.zksync.io/images/logo-no-letters.svg",
  description: "zk Auction app",
  /** When no injected wallets detected, recommend the user to install some*/
  recommendedInjectedWallets: [{ name: "argent", url: "https://www.argent.xyz/" }, { name: "Metamask", url: "https://metamask.io/" }]
}

//chain
const zkSyncTesnet = {
  id: "0x118",
  token: "ETH",
  label: "zkSync Goerli",
  rpcUrl: "https://testnet.era.zksync.dev", // "https://zksync2-testnet.zksync.dev",
  icon: "https://app.wagmi.com/static/media/zkSync-logo.172fcde2.png",
  blockExplorerUrl: "https://goerli.explorer.zksync.io",
  secondaryTokens: [{ address: USDC, }, { address: DAI }]
}
const localhost = {
  id: 270,
  token: "ETH",
  label: "L2 local zkSync",
  rpcUrl: "http://localhost:3050", // 
  icon: "https://app.wagmi.com/static/media/zkSync-logo.172fcde2.png",
  blockExplorerUrl: "https://goerli.explorer.zksync.io",
  secondaryTokens: [{ address: USDC_LOCAL, }, { address: DAI_LOCAL }]
}
const argent = argentModule({});
const injected = injectedModule()
// web3 onboard
const web3Onboard =
  await init({
    apiKey: "d9e51637-c3dd-4e41-89b7-27cfda6cab3c",
    wallets: [argent, injected],
    appMetadata: appMetadata,
    chains: [
      zkSyncTesnet, localhost
    ],
    connect: {
      autoConnectLastWallet: true
    }
  })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Web3OnboardProvider web3Onboard={web3Onboard}>
    <RouterProvider router={router} />
    </Web3OnboardProvider>
  </React.StrictMode>,
)
