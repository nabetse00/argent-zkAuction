// @ts-ignore
import { Web3Storage } from "web3.storage";

import { MessageInstance } from "antd/es/message/interface";
import { AuctionJson } from "./ContractInteraction";
const MAX_RETRY = 10;
const DELAY_MS = 20000


export async function uploadJson(obj: Object, message: MessageInstance): Promise<string | undefined> {
    const client = new Web3Storage({ token: `${import.meta.env.VITE_WEB3_API}` })
    let rootCid = ""
    try {
        //const obj = { hello: 'world' }
        const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' })
        // console.log(`${import.meta.env.VITE_WEB3_API}`)

        const upfile = new File([blob], 'item.json')

        rootCid = await client.put([upfile])
        const info = await client.status(rootCid)
        console.log(`satus info ${info}`)

    } catch (e: any) {
        message.error(`Files upload failed. ${e.message}`);
        console.error(e);
    }
    const result = await getFileFromCid(client, rootCid, message)
    return result;
};

export function formatCid(cid: string) {
    return `${cid.slice(0, 4)}...${cid.slice(-4)}`
}

export async function getJsonFile(cid: string) {
    const client = new Web3Storage({ token: `${import.meta.env.VITE_WEB3_API}` })
    const res = await client.get(cid)
    const files = await res.files();
    const url = `https://${files[0].cid}.ipfs.w3s.link`
    const json: AuctionJson = await fetch(
        url
        , {
            //mode: 'no-cors',
            method: 'GET',
            headers: {
                // 'Content-Type': 'application/json',
                'Accept': '*/*',
                // 'Access-Control-Allow-Origin': '*',
                "user-agent": "watever/2023.4.0"
            }
        }
    )
        .then(function (response) {
            console.log(`response: ${JSON.stringify(response)}`)
            return response.json();
        })

    return json;
}

export async function getImageUrl(cid: string) {
    const client = new Web3Storage({ token: `${import.meta.env.VITE_WEB3_API}` })
    const res = await client.get(cid)
    const files = await res.files();
    const url = `https://${files[0].cid}.ipfs.w3s.link`
    return url;
}


export async function getFileFromCid(client: any, rootCid: string,
    message: MessageInstance, retryCount: number = 1): Promise<string | undefined> {
    const currRetry = typeof retryCount === 'number' ? retryCount : 1;
    await delay(DELAY_MS)
    try {
        console.log(`get file [${rootCid}]`)
        const res = await client.get(rootCid) // Promise<Web3Response | null>
        const files = await res.files() // Promise<Web3File[]>
        for (const file of files) {
            console.log(`WEB3: ${file.cid} ${file.name} ${file.size}`)
        }
        message.success(`Json file successfully uploaded ${formatCid(rootCid)}`);
        return files[0].cid;
    } catch (e: any) {
        if (currRetry > MAX_RETRY) {
            message.error(`Files upload failed. ${e.message}`);
            console.error(e);
            return
        }
        return getFileFromCid(client, rootCid, message, currRetry + 1);
    }
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
