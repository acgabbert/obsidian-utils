import { request, RequestUrlParam } from "obsidian";
import { getIocType } from "..";
import type { VtDomainResponse, VtFileResponse, VtIpResponse } from "./models/virusTotalModels";
import { vtDefaultDomainTemplate, vtDefaultFileTemplate, vtDefaultIpTemplate } from "./templates/virusTotalTemplates";

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
                resp = "VirusTotal request failed.";
                break;
            }
            //if (!template) template = vtDefaultIpTemplate;
            //resp = vtIpTemplate(template, data);
            break;
        case 'domain':
            vtParams.url = `${vtBaseUrl}domains/${val}`;
            try {
                data = JSON.parse(await request(vtParams)).data as VtDomainResponse;
            } catch(err) {
                console.error(err);
                resp = "VirusTotal request failed.";
                break;
            }
            //if (!template) template = vtDefaultDomainTemplate;
            //resp = vtDomainTemplate(template, data);
            break;
        case 'hash':
            vtParams.url = `${vtBaseUrl}files/${val}`;
            try {
                data = JSON.parse(await request(vtParams)).data as VtFileResponse;
            } catch(err) {
                console.error(err);
                resp = "VirusTotal request failed.";
                break;
            }
            //if (!template) template = vtDefaultFileTemplate;
            //resp = vtFileTemplate(template, data);
            break;
        case null:
            //resp = `Search query invalid: ${val}`;
            break;
    }
    resp = JSON.stringify(data, undefined, 2);
    return resp;
}

function vtFileTemplate(vtObj: VtFileResponse, template?: string): string {
    if (!template) template = vtDefaultFileTemplate;

    return template;
}

function vtIpTemplate(vtObj: VtIpResponse, template?: string): string {
    if (!template) template = vtDefaultIpTemplate;

    return template;
}

function vtDomainTemplate(vtObj: VtDomainResponse, template?: string): string {
    if (!template) template = vtDefaultDomainTemplate;

    return template;
}