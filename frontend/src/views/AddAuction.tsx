import { Button, Card, Form, Input, InputNumber, Radio, Space, Tooltip, Typography, App } from 'antd';
import UploadFile from '../components/Upload';
import TextArea from 'antd/es/input/TextArea';
import { useState } from 'react';
import { useConnectWallet } from '@web3-onboard/react';
import { createAuction, ItemData } from '../services/ContractInteraction';
import { uploadJson } from '../services/ipfs';
import { useNavigate } from "react-router-dom";

export interface AuctionData {
  product_description: string;
  product_pictures: string;
  product_manufacturer: string;
  product_model: string;
  product_name: string;
  product_start_price: string
  product_auction_token: "USDC"|"DAI";
  product_buy_it_price: string;
  product_duration: number;
}

export default function AddAuction() {
  const { message} = App.useApp();
  const [{ wallet }] = useConnectWallet()
  const [creating, setCreating] = useState<boolean>(false)

  const [_auctionData, setAuctionData] = useState<AuctionData>()

  const navigate = useNavigate();

  async function onFinish(values: AuctionData) {
    setCreating(true);
    console.log('Received values of form: ', values);
    setAuctionData(values);
    const tokenURI = await uploadJson(values, message);
    console.log(`Auction item tokenURI: ${tokenURI}`)
    if(wallet){
      // await estimateGas(wallet, values.product_auction_token, Methods.APPROVE_ERC20)
      // await estimateGas(wallet, values.product_auction_token, Methods.AUCTION_CREATE)
      const item: ItemData = {
        tokenUri: tokenURI!,
        startPrice: values.product_start_price,
        buyItNow: values.product_buy_it_price,
        durationHours: values.product_duration
      }
      const result = await createAuction(item, wallet, values.product_auction_token)
      if(result){
        message.success("Auction Created !")
        navigate("/auctions");
      }else{
        message.error("Auction creation failed")
      }
    }else{
      console.log("no wallet")
    }
    setCreating(false)
  };

  const tokenOptions = [
    { label: 'USDC', value: 'USDC' },
    { label: 'DAI', value: 'DAI' },
  ];

  return (
    <Card title="Create a new Auction">
      <Form
        name="complex-form"
        onFinish={onFinish}
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 16 }}
        style={{ maxWidth: 700 }}
      >

        <Form.Item label="Product name">
          <Space>
            <Form.Item
              name="product_name"
              noStyle
              rules={[{ required: true, message: 'Product name is required' }]}
            >
              <Input style={{ width: 300 }} placeholder="Please input" />
            </Form.Item>
            <Tooltip title="Product name">
              <Typography.Text>Please input a name for this product</Typography.Text>
            </Tooltip>
          </Space>
        </Form.Item>
        <Form.Item label="Product Description">
          <Space>
            <Form.Item
              name="product_description"
              noStyle
              rules={[{ required: true, message: 'Product descriptionis required' }]}
            >
              <TextArea style={{ width: 300 }} placeholder="Please input" />
            </Form.Item>
            <Tooltip title="Product name">
              <Typography.Text>Please input a short description</Typography.Text>
            </Tooltip>
          </Space>
        </Form.Item>
        <Form.Item label="Manufacturer">
          <Space>
            <Form.Item
              name="product_manufacturer"
              noStyle
              rules={[{ required: true, message: 'Product manufacturer is required' }]}
            >
              <Input style={{ width: 200 }} placeholder="Please input" />
            </Form.Item>
            <Tooltip title="Product manufacturer">
              <Typography.Text>Who made this product</Typography.Text>
            </Tooltip>
          </Space>
        </Form.Item>
        <Form.Item label="Product Model">
          <Space>
            <Form.Item
              name="product_model"
              noStyle
              rules={[{ required: true, message: 'Product model is required' }]}
            >
              <Input style={{ width: 200 }} placeholder="Please input" />
            </Form.Item>
          </Space>
        </Form.Item>
        <Form.Item label="Product Pictures">
          <Form.Item
            name="product_pictures"
            noStyle
            rules={[{ required: true, message: 'Product fotos must be uploaded' }]}
          >
            {/* @ts-ignore */}
            <UploadFile />
          </Form.Item>
        </Form.Item>

        <Form.Item label="Auction token">
          <Space>
            <Form.Item
              name="product_auction_token"
              noStyle
              rules={[{ required: true, message: 'Product auction token required' }]}
            >
              <Radio.Group
                options={tokenOptions}
                optionType="button"
                buttonStyle="solid"
              />
            </Form.Item>
          </Space>
        </Form.Item>

        <Form.Item label="Starting Price">
          <Space>
            <Form.Item
              name="product_start_price"
              noStyle
              rules={[{ required: true, message: 'Product Start price is required' }]}
            >
              <InputNumber min={0.01}
                step="0.01"
                prefix="$"
                stringMode
                style={{ width: 200 }}
                placeholder="Please input" />
            </Form.Item>
          </Space>
        </Form.Item>
        <Form.Item label="Buy it now Price">
          <Space>
            <Form.Item
              name="product_buy_it_price"
              noStyle
              rules={[{ required: true, message: 'Product buy it now price required' }]}
            >
              <InputNumber min={0.02}
                step="0.05"
                prefix="$"
                stringMode
                style={{ width: 200 }}
                placeholder="Please input" />
            </Form.Item>
          </Space>
        </Form.Item>

        <Form.Item label="Auction Duration [in hours]">
          <Space>
            <Form.Item
              name="product_duration"
              noStyle
              rules={[{ required: true, message: 'Product buy it now price required' }]}
            >
              <InputNumber min={1}
                max={7 * 24}
                step="1"
                suffix="hours"
                style={{ width: 200 }}
                placeholder="Please input" />
            </Form.Item>
          </Space>
        </Form.Item>

        <Form.Item label=" " colon={false}>
          <Button disabled={creating} loading={creating} type="primary" htmlType="submit">
            Submit Auction
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );

}


