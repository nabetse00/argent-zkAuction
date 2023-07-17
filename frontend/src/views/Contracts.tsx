import { List, Avatar } from "antd";
import { daiAddr, usdcAddr, auctionFactoryAddr, paymasterAddr } from "../services/ContractInteraction";

export default function Contracts() {

    const data = [
        {
            title: "USDC Address",
            description: usdcAddr,
            avatar: "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png",
        },
        {
            title: "DAI Address",
            description: daiAddr,
            avatar: "https://s2.coinmarketcap.com/static/img/coins/64x64/4943.png",
        },
        {
            title: "Auction Factory Address",
            description: auctionFactoryAddr,
            avatar: "https://plugins.jetbrains.com/files/18551/349727/icon/pluginIcon.svg",
        },
        {
            title: "Paymaster Address",
            description: paymasterAddr,
            avatar: "https://plugins.jetbrains.com/files/18551/349727/icon/pluginIcon.svg",
        },
    ];


    return (
        <List
            itemLayout="horizontal"
            dataSource={data}
            renderItem={(item, _index) => (
                <List.Item>
                    <List.Item.Meta
                        avatar={<Avatar src={item.avatar} />}
                        title={<a href={`https://goerli.explorer.zksync.io/address/${item.description}`}>{item.title}</a>}
                        description={`${item.description}`}
                    />
                </List.Item>
            )}
        />
    )
} 