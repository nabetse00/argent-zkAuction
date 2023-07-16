// import './App.css'
import Login from './components/Login'
import logo from './assets/svg/logo-no-background-color.svg'


import { createElement } from 'react';
import { AppstoreOutlined, FileAddOutlined, LaptopOutlined, MailOutlined, NotificationOutlined, SettingOutlined, UnorderedListOutlined, UserOutlined } from '@ant-design/icons';
import type { MenuProps, ThemeConfig } from 'antd';
import { Breadcrumb, App as AntdApp, ConfigProvider, Layout, Menu, theme } from 'antd';


import { Link, Outlet } from 'react-router-dom';
import RequireConnection from './components/RequireConnect';
import { useConnectWallet } from '@web3-onboard/react';



const { Header, Content, Footer, Sider } = Layout;

const items: MenuProps['items'] = [
  {
    label: <Link to="/create-auction"> Create Auction</Link>,
    key: 'create',
    icon: <FileAddOutlined />,
  },
  {
    label: <Link to="/auctions"> Auctions List</Link>,
    key: 'auctions',
    icon: <UnorderedListOutlined />,
    disabled: false,
  },
];


const { darkAlgorithm } = theme
const config: ThemeConfig = {
  token: {
    colorPrimary: '#ffbe79',
  },
  algorithm: [darkAlgorithm],
};

// By static function
const { getDesignToken, useToken } = theme;
const globalToken = getDesignToken(config);



export default function App() {
  const [{ wallet }] = useConnectWallet()

  return (
    <ConfigProvider
      theme={config}
    >

      <AntdApp>
        <Layout style={{ minHeight: "100vh" }}>
          <Header style={{ display: 'flex', alignItems: 'center', padding: "4em" }}>
            <img src={logo} alt="zkAuction Logo" width={200} style={{ margin: "2em" }} />
            <div className="demo-logo" />
            <Menu style={{ minWidth: 0, flex: "auto" }} theme="dark" mode="horizontal" defaultSelectedKeys={['app']} items={items} />
            <Login />
          </Header>
          <Content style={{ padding: '0 50px', }}>
            <Breadcrumb style={{ margin: '16px 0' }}>
              <Breadcrumb.Item>Home</Breadcrumb.Item>
              <Breadcrumb.Item>List</Breadcrumb.Item>
              <Breadcrumb.Item>App</Breadcrumb.Item>
            </Breadcrumb>
            <Layout style={{ padding: '24px 0', background: globalToken.colorBgContainer }}>
              <Sider style={{ background: globalToken.colorBgContainer }} width={200}>
                <Menu
                  mode="inline"
                  defaultSelectedKeys={['1']}
                  defaultOpenKeys={['sub1']}
                  style={{ height: '100%' }}
                  items={items}
                />
              </Sider>
              <Content style={{ padding: '0 24px', minHeight: 280 }}>
                {wallet ? <Outlet /> :
                  <RequireConnection />
                }
              </Content>
            </Layout>
          </Content>
          <Footer style={{ textAlign: 'center' }}>Argent zkSync ©2023</Footer>
        </Layout>
      </AntdApp>
    </ConfigProvider>
  );
};
