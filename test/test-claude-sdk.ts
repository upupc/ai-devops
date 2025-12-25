import {
    query,
    type SDKMessage,
} from "@anthropic-ai/claude-agent-sdk";
import * as fs from "fs";
import * as path from "path";

const WORKSPACES_ROOT = process.env.WORKSPACES_ROOT
    ? path.resolve(process.env.WORKSPACES_ROOT)
    : path.join(process.cwd(), "workspaces");
const workspacePath = path.join(WORKSPACES_ROOT, "default_chat");
const systemMdPath = path.join(workspacePath, "SYSTEM.md");
let systemContent = '';
if (fs.existsSync(systemMdPath)) {
    systemContent = fs.readFileSync(systemMdPath, "utf-8").trim();
}
const defaultSystemPrompt:{ type: 'preset'; preset: 'claude_code',append?: string; } | string = {
    type: 'preset', preset: 'claude_code', append:systemContent};

type MyMessage = {
    type:string,
    subtype?:string,
    message?:{
        content:string|[{type:string,text:string,name:string,id:string,input:string}]
    },
    result?:string
};

function printMessage(message: MyMessage) {
    const content= message.message?.content||message.result;
    if (typeof content === "string") {
        console.log(message.type + ' : ' + content);
    } else if (Array.isArray(content)) {
        content.forEach((block) => {
            if (block.type === "text") {
                console.log(message.type + ' : ' + block.text)
            } else if (block.type === "tool_use") {
                console.log(message.type + ' : %s %s %s' , block.name, block.id, JSON.stringify(block.input))
            }
        });
    }
}

console.log("workspacePath:"+workspacePath);

const prompt = `/init-workspace --path ${workspacePath} --git-repo http://huanggu.ly:q3nNoM1t6JsgRCdkCZLF@gitlab.alibaba-inc.com/onetouch-tech/onetouch-ames-base.git`;


const queryResult = query({
    prompt: prompt,
    options: {
        maxTurns: 10,
        model: "claude-sonnet-4-5-20250929",
        systemPrompt: defaultSystemPrompt,
        cwd: workspacePath,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions:true,
        tools: {
            type: "preset",
            preset: "claude_code",
        },
        settingSources: ["project"],
        // resume: '3cb258e4-1385-4bc4-bef7-459a7a3238cf',
        stderr: data => console.log('sdk:' + data)
    }
});


for await (const message of queryResult) {
    const mymessage = message as MyMessage;
    printMessage(mymessage);
    if(message.type=='result'){
        break;
    }
}