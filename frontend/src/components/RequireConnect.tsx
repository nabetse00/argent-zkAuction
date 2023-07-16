import { Alert, Typography } from "antd";
import Login from "./Login";
const { Paragraph } = Typography;

export default function RequireConnection() {

    const message =
        <>
            <Paragraph>Please connect your wallet to this dapp</Paragraph>
            <Login />
        </>
    return (
        <Alert
            message="Please connect your wallet!"
            description={message}
            type="error"
            showIcon
        />
    );
}