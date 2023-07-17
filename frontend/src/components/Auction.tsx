import { App, Card, Space, Statistic } from "antd";
import { useEffect, useState } from "react";
import { Address } from "zksync-web3/build/src/types";
import { AuctionConfig, AuctionJson, AuctionStatus, buyItNow, getAuctionConfig, getAuctionHighestBider, getAuctionHighestBinding, getAuctionStatus, getTokenUri, placeBid, withdraw } from "../services/ContractInteraction";
import { WalletState } from "@web3-onboard/core";
import { getImageUrl, getJsonFile } from "../services/ipfs";
import { EditOutlined, SettingOutlined } from "@ant-design/icons";
import Countdown from "antd/es/statistic/Countdown";



export default function Auction(props: { wallet: WalletState, auctionAddress: Address, auctionItemsAddress: Address }) {


    const [auctionCfg, setAuctionCfg] = useState<AuctionConfig>()
    const [json, setJson] = useState<AuctionJson>()
    const [imgUrl, setImgUrl] = useState<string>()
    const [highestBindingBid, setHighestBindingBid] = useState<string>()
    const [highestBindingBider, setHighestBindingBider] = useState<Address>()
    const [auctionStatus, setAuctionStatus] = useState<AuctionStatus>()
    const [statusUpdate , setStatusUpdate] = useState<boolean>(false)
    const { message } = App.useApp();


    async function withdrawAction() {
        setStatusUpdate(true)
        await withdraw(props.wallet, props.auctionAddress)
        setStatusUpdate(false)
    }


    async function placeBidAction() {
        setStatusUpdate(true)
        const result = await placeBid(props.wallet, props.auctionAddress)
        if (result) {
            message.success("Bid successfull")
            
        } else {
            message.error("Bid failed")
        }
        setStatusUpdate(false)

    }

    async function buyItNowAction() {
        setStatusUpdate(true)
        const result = await buyItNow(props.wallet, props.auctionAddress, auctionCfg!.buyItNowPrice)
        if (result) {
            message.success("Bid successfull")
        } else {
            message.error("Bid failed")
        }
        setStatusUpdate(false)

    }

    async function getData() {
        const cfg = await getAuctionConfig(props.wallet, props.auctionAddress)
        setAuctionCfg(cfg)
        const uri = await getTokenUri(props.wallet, cfg.itemTokenId, props.auctionItemsAddress)
        const json = await getJsonFile(uri);
        setJson(json)
        const img = await getImageUrl(json.product_pictures)
        setImgUrl(img)
        const hhb_str = await getAuctionHighestBinding(props.wallet, props.auctionAddress);
        setHighestBindingBid(hhb_str)
        const status = await getAuctionStatus(props.wallet, props.auctionAddress)
        setAuctionStatus(status)
        const hb = await getAuctionHighestBider(props.wallet, props.auctionAddress)
        setHighestBindingBider(hb)
    }

    useEffect(() => {
        getData().then().catch(
            e => { console.error(e) }
        )
    },
        [props.wallet, statusUpdate]
    )



    return (

        <Card
            loading={statusUpdate}
            hoverable
            style={{ width: 400 }}
            cover={<div style={{ alignItems: "center", textAlign: "center", overflow: "hidden", height: "200px", background: "white" }}>
                <img
                    alt="example"
                    style={{ height: "100%" }}
                    src={imgUrl}
                />
            </div>}
            title={`${auctionCfg?.itemTokenId} - ${json?.product_name}`}
            actions={auctionStatus != AuctionStatus.ENDED ?[
                <><SettingOutlined key="setting" onClick={placeBidAction} /> Bid</>,
                <><EditOutlined key="edit" onClick={buyItNowAction} />Buy Now</>,
            ]: [<><EditOutlined key="edit" onClick={withdrawAction} />WithDraw</>]}
        >
            <Statistic title="Description" value={`${json?.product_description}`} />
            <Statistic title="Model" value={`${json?.product_model} - ${json?.product_manufacturer}`} />
            {auctionStatus != AuctionStatus.ENDED ?
                <Space align="center" direction="horizontal" size={"middle"} >
                    <Statistic title="Current Bid" value={highestBindingBid} prefix={"$"} />
                    <Statistic title="Buy it now Price" value={json?.product_buy_it_price} prefix={"$"} />
                    <Countdown title="Auction ends in" value={auctionCfg?.endTimestamp.mul(1000).toNumber()} onFinish={() => "ENDED"} />
                </Space> :
                <>ENDED Winner {highestBindingBider}</>
            }

        </Card>
    );
}