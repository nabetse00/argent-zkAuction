import { useEffect, useState } from 'react'
import { useConnectWallet } from '@web3-onboard/react'
import { Button, Spin } from 'antd'
import { LoginOutlined, LogoutOutlined } from '@ant-design/icons'

import { Web3Provider } from 'zksync-web3'

export default function Login() {
  const [{ wallet, connecting }, connect, disconnect, updateBalance] = useConnectWallet()
  const [_ethersProvider, setProvider] = useState<Web3Provider | null>()
  //const [account, setAccount] = useState<Account | null>({ address: "", balance: { "": "" } })


  useEffect(() => {
    // If the wallet has a provider than the wallet is connected
    if (wallet?.provider) {
      console.log(wallet.accounts)
      setProvider(new Web3Provider(wallet.provider, 'any'))
      // if using ethers v6 this is:
      // ethersProvider = new ethers.BrowserProvider(wallet.provider, 'any')
    }
  }, [wallet])

  useEffect(() => {
    if (wallet?.provider) {
      console.log(wallet.accounts)
    }
  }, [wallet])

  const connectWallet = async () => {
    await connect()
    await updateBalance()
  }

  return (
    <div>
      <Button icon={connecting ? <Spin /> : wallet ? <LogoutOutlined /> : <LoginOutlined />} disabled={connecting} onClick={() => (wallet ? disconnect(wallet) : 
        connectWallet() )}>
        {connecting ? 'connecting' : wallet ? 'disconnect' : 'connect'}
      </Button>
    </div>
  )
}
