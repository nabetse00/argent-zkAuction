import { UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { App, Button, Upload } from 'antd';

import { RcFile } from 'antd/es/upload';
import { useState } from 'react';

import type { UploadFile } from 'antd/es/upload/interface';
// @ts-ignore
import { Web3Storage } from "web3.storage";
import { getFileFromCid } from '../services/ipfs';

const client = new Web3Storage({ token: `${import.meta.env.VITE_WEB3_API}` })

export default function UploadFile(props: { value: string, onChange: (arg: string) => void }) {
    const { message } = App.useApp();

    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const [uploading, setUploading] = useState(false);

    const handleSubmission = async () => {
        setUploading(true)
        try {

            const upfiles: RcFile[] = [];

            //console.log(`${import.meta.env.VITE_WEB3_API}`)

            fileList.forEach((file) => {
                if (file.originFileObj) {
                    console.log(`file ====> ${file.originFileObj}`)
                    upfiles.push(file.originFileObj);
                }
            });

            const rootCid = await client.put(upfiles)
            const info = await client.status(rootCid)
            console.log(`satus info ${info}`)
            await getFileFromCid(client, rootCid, message, 10)
            const res = await client.get(rootCid) // Promise<Web3Response | null>
            const files = await res.files() // Promise<Web3File[]>
            for (const file of files) {
                console.log(`WEB3: ${file.cid} ${file.name} ${file.size}`)
            }
            message.success(`Files uploaded successfully. folder is ${rootCid} [${files.length} files]`);
            props.onChange(rootCid)
        } catch (e: any) {
            message.error(`Files upload failed. ${e.message}`);
            console.error(e);
        } finally {
            setUploading(false)
        }
    };

    const uploadProps: UploadProps = {
        name: 'file',
        multiple: true,
        listType: "picture-card",
        //action: actionUpload,
        onChange(info) {
            const { status } = info.file;
            if (status !== 'uploading') {
                console.log("===========>>> status updaloding ")
                console.log(info.file, info.fileList);
                setFileList([...info.fileList])
            }
            if (status === 'done') {
                console.log("===========>>> status done ")
                message.success(`${info.file.name} file uploaded successfully.`);
            } else if (status === 'error') {
                console.log("===========>>> status error ")
                message.error(`${info.file.name} file upload failed.`);
            }
        },
        beforeUpload: (file) => {
            setFileList([...fileList, file]);
            return false;
        },
        //fileList:fileList
    };


    return (
        <>
            <Upload {...uploadProps}>
                <UploadOutlined />Select Files
            </Upload>
            <Button
                type="primary"
                onClick={handleSubmission}
                disabled={fileList.length === 0}
                loading={uploading}
                style={{ marginTop: 16 }}
            >
                {uploading ? 'Uploading to IPFS' : 'Start Upload to IPFS'}
            </Button>
        </>
    );
}