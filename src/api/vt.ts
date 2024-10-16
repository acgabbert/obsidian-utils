import { request, RequestUrlParam } from "obsidian";
import { getIocType } from "..";
import type { VtDomainResponse, VtFileResponse, VtIpResponse } from "./models/virusTotal";
import { vtDefaultFileTemplate } from "./templates/virusTotal";

export { virusTotalRequest };

const vtBaseUrl = "https://www.virustotal.com/api/v3/";

async function virusTotalRequest(val: string, key: string, template?: string): Promise<string | null> {
    val = val.trim().toLowerCase();
    let requestUrl = vtBaseUrl;
    const iocType = getIocType(val);
    let resp = "";
    let data;

    const headers = {'x-apikey': key};
    const vtParams = {url: requestUrl, headers: headers, throw: true} as RequestUrlParam;

    switch(iocType) {
        case 'ip':
            vtParams.url = `${vtBaseUrl}ip_addresses/${val}`;
            try {
                data = JSON.parse(await request(vtParams)).data as VtIpResponse;
            } catch(err) {
                console.error(err);
                return "VirusTotal request failed.";
            }
            if (!template) template = vtDefaultTemplate;
            resp = vtIpTemplate(template, data);
            break;
        case 'domain':
            vtParams.url = `${vtBaseUrl}domains/${val}`;
            try {
                data = JSON.parse(await request(vtParams)).data as VtDomainResponse;
            } catch(err) {
                console.error(err);
                return "VirusTotal request failed.";
            }
            if (!template) template = vtDefaultTemplate;
            resp = vtDomainTemplate(template, data);
            break;
        case 'hash':
            vtParams.url = `${vtBaseUrl}files/${val}`;
            try {
                data = JSON.parse(await request(vtParams)).data as VtFileResponse;
            } catch(err) {
                console.error(err);
                return "VirusTotal request failed.";
            }
            if (!template) template = vtDefaultTemplate;
            resp = vtFileTemplate(template, data);
            break;
        case null:
            return null;
    }
    try {
        data = await request(vtParams);
    } catch(err) {
        console.error(err);
        return "VirusTotal request failed.";
    }
    switch(iocType) {
        case 'ip':
            data = JSON.parse(data).data as VtIpResponse;
            break;
        case 'domain':
            data = JSON.parse(data).data as VtDomainResponse;
            break;
        case 'hash':
            data = JSON.parse(data).data as VtFileResponse;
            if (!template) template = vtDefaultFileTemplate;
            resp = vtFileTemplate(template, data);
            break;
    }
    return resp;
}

function vtFileTemplate(template: string, vtObj: VtFileResponse): string {
    return template;
}

function vtIpTemplate(template: string, vtObj: VtIpResponse): string {
    return template;
}

function vtDomainTemplate(template: string, vtObj: VtDomainResponse): string {
    return template;
}