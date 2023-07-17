import { useConnectWallet } from "@web3-onboard/react"
import { useEffect, useState } from "react"
import { getAuctionItems, getAuctionsAddresses } from "../services/ContractInteraction"
import Auction from "../components/Auction"
import { WalletState } from "@web3-onboard/core"
import { Row } from "antd"


export default function AuctionsView() {
    const [{ wallet }] = useConnectWallet()

    const [auctions, setAuctions] = useState<string[]>([])
    const [auctionItemAddr, setAuctionItemAddr] = useState<string>("")

    async function getData(wallet: WalletState | null) {
        if (wallet) {
            const addr = await getAuctionItems(wallet);
            setAuctionItemAddr(addr)
            const as = await getAuctionsAddresses(wallet);
            setAuctions(as);

        }

    }

    useEffect(() => {
        getData(wallet).catch(
            e => { console.error(e) })
    }, [wallet])

    return (
        <Row justify="space-evenly">
            {auctions.map((v, i) => <Auction key={i} wallet={wallet!} auctionAddress={v} auctionItemsAddress={auctionItemAddr} />)}
        </Row>
    )

}