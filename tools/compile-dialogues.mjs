// Mechanical compilation of two dialogue sources for file:// offline playback.
// Never paraphrase either source. Run after editing the authored sources.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const md=fs.readFileSync(path.join(root,'docs/DIALOGUE_40_V1_2026-10-31.md'),'utf8');
const pieces=[...md.matchAll(/^###\s+(\d\d)\s+·[^\n]*?`([A-Z0-9_]+)`[^\n]*\n([\s\S]*?)(?=^###\s+\d\d\s+·|^##\s+|(?![\s\S]))/gm)];
const normal={};
for (const [,number,key,body] of pieces) {
    const lines=[...body.matchAll(/^-\s+\*\*([^*]+):\*\*\s*(.+)$/gm)]
        .map(([,label,value])=>({label,text:value.trim().replace(/^“|”$/g,'')}));
    const openingMale=lines.find(x=>x.label==='시작/남');
    const openingFemale=lines.find(x=>x.label.startsWith('시작/여'));
    const ending=lines.find(x=>x.label.startsWith('클리어/여'))||lines.at(-1);
    const triggers=lines.filter(x=>!x.label.startsWith('시작/')&&x!==ending);
    assert(openingMale&&openingFemale&&ending&&triggers.length,`normal stage ${number} incomplete`);
    normal[key]={male:openingMale.text,female:openingFemale.text,
        trigger:triggers[0].text,triggerLabel:triggers[0].label,clear:ending.text,
        extras:triggers.slice(1).map(x=>x.text)};
}
assert.equal(Object.keys(normal).length,40,'normal dialogue scenes');
const source={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'js/dialogue-hardcore.js'),'utf8'),source);
const lines=source.window.GAIA_HARDCORE_LINES;
assert.equal(lines.length,40,'user-provided EX-Hardcore dialogue scenes');
assert(lines.every(row=>row.length===4&&row.every(line=>typeof line==='string'&&line.length>10)));
const staged=fs.readFileSync(path.join(root,'js/stages40.js'),'utf8');
const sceneContext={window:{}};
vm.runInNewContext(staged,sceneContext);
const stages=sceneContext.window.GAIA_40_STAGES;
const hardcore={};
stages.forEach((stage,index)=>{
    const [male,female,trigger,clear]=lines[index];
    const exemplar=normal[stage.sceneKey];
    assert(exemplar,`missing normal ${stage.sceneKey}`);
    hardcore[stage.sceneKey]={male,female,trigger,clear,
        triggerLabel:exemplar.triggerLabel,extras:[]};
});
// Stage 40 has a second, separately supplied line at the third heart hit.
hardcore.POLICE_ENDING.extras=[
    '우승입니다! 아아, 드디어 이 정액 차오르는 기록을 보네요! 제가 원하던 결말입니다♡'
];
const result={normal,hardcore};
const output='// Generated from the NORMAL source and user-supplied EX-Hardcore lines.\n'+
    'window.GAIA_DIALOGUES = '+JSON.stringify(result,null,2)+';\n';
fs.writeFileSync(path.join(root,'js/dialogues-data.js'),output);
const hardDocument=[
    '# GAIA CITY · HEART BREAKER — 40판 EX-HARDCORE 대사집',
    '',
    '사용자가 제공한 제미나이 대사 원문. 표현을 바꾸지 않고 게임 데이터와 동일하게 보존한 판본입니다.',
    ''
];
stages.forEach((stage,index)=>{
    const entry=hardcore[stage.sceneKey];
    hardDocument.push(`### ${String(index+1).padStart(2,'0')} · ${stage.name} \`${stage.sceneKey}\``,
        `- **시작/남:** “${entry.male}”`,
        `- **시작/여:** “${entry.female}”`,
        `- **${entry.triggerLabel}:** “${entry.trigger}”`);
    for(const extra of entry.extras) hardDocument.push(`- **추가 반응/여:** “${extra}”`);
    hardDocument.push(`- **클리어/여:** “${entry.clear}”`,'');
});
fs.writeFileSync(path.join(root,'docs/DIALOGUE_40_EX_HARDCORE_USER_2026-10-31.md'),hardDocument.join('\n'));
console.log(`Compiled ${Object.keys(normal).length} NORMAL + ${Object.keys(hardcore).length} EX-HARDCORE scenes`);
