// GAIA HEART BREAKER — forty authored rounds (eight venues, five tiers each).
// Stage definitions are deliberately independent of the original DX-Ball config.
// Generated coordinates are deterministic: a retry never silently changes the board.
(function () {
    'use strict';
    const venues = ['핑크 마트','하트 공원','비밀의 방','촬영 스튜디오','가이아 카지노','캔디 농장','호스트 클럽','가이아 경찰서'];
    const data = [];
    const add = (name,key,rows,count,clear,objectives={},features={}) => {
        const n = data.length + 1;
        const character=n===10?'brown':(n===15||n===20||n===40)?'choseon':n%2?'brown':'choseon';
        data.push({ id:n, stageId:n, chapter:Math.floor((n-1)/5), tier:(n-1)%5+1,
            venue:venues[Math.floor((n-1)/5)], name, sceneKey:key, character, rows, count, clear,
            objectives, features, ballSpeed:3.8+Math.floor((n-1)/5)*.23+((n-1)%5)*.09 });
    };
    // Goals are independent counters. E.g. soccer:[1,1] requires one score at EACH goal.
    add('첫 진열','MART_BASIC',7,60,1,{}, {wood:30});
    add('젤리 시식','MART_JELLY',7,64,1,{}, {jelly:40});
    add('철제 계산대','MART_METAL',8,68,.95,{}, {metal:10});
    add('폭탄 할인전','MART_BOMB',8,72,.90,{bombChain:1},{bomb:3,wood:30});
    add('매진 쇼타임','MART_FINALE',8,76,.90,{quickChain:1},{jelly:16,wood:18,metal:8,neon:14,bomb:4,recolor:5});

    // One fully art-directed prototype goal board. Animated rear-view character
    // and its moving, visible scoring target share the same pose clock.
    add('첫 골','PARK_GOAL1',8,68,.80,{soccer:[1]},{wood:25,goalCharacter:true});
    add('젤리 프리킥','PARK_JELLY',8,72,.85,{soccer:[2]},{jelly:40});
    add('움직이는 골대','PARK_MOVING',8,76,.85,{soccer:[1]},{jelly:22,goalMove:28});
    add('수비벽 돌파','PARK_DEFENSE',9,82,.85,{soccer:[2]},{metal:12,movers:2,goalMove:34});
    add('하트컵 결승','PARK_FINAL',9,86,.90,{soccer:[3]},{jelly:27,goalMove:35,alternate:true});

    add('누가 계세요?','ROOM_REVEAL',8,68,.80,{reflect:[1]},{wood:20,reveal:.35});
    add('두 번째 노크','ROOM_TWICE',8,72,.85,{reflect:[2]},{wood:22,jelly:25,reveal:.38});
    add('두 분 예약','ROOM_DUO',9,78,.85,{reflect:[1,1]},{jelly:25,reveal:.3});
    add('가로막힌 비밀','ROOM_GUARD',9,82,.85,{reflect:[3]},{movers:1,reveal:.4});
    add('비밀 공개 쇼','ROOM_FINAL',9,86,.90,{reflect:[2,2]},{neon:20,lightning:3,recolor:6,reveal:.4});

    add('첫 테이크','STUDIO_TAKE1',8,70,.75,{basket:[1]},{wood:25});
    add('이동 카메라','STUDIO_MOVE',8,74,.80,{basket:[1]},{basketMove:40});
    add('더블 테이크','STUDIO_DOUBLE',8,78,.80,{basket:[2]},{wood:35,basketMove:60});
    add('컷 없이 진행','STUDIO_NG',9,84,.85,{basket:[2]},{movers:1,basketMove:60});
    add('바스켓 쇼타임','STUDIO_FINAL',9,88,.85,{basket:[1,1]},{basketMove:60});

    add('첫 베팅','CASINO_BET',8,72,.85,{}, {movers:1,metal:8});
    add('더블 바리케이드','CASINO_DOUBLE',9,78,.90,{}, {movers:2,metal:10});
    add('독이 든 칩','CASINO_POISON',9,82,.85,{poisonChain:1},{movers:1,poison:2});
    add('룰렛 타이밍','CASINO_TIMING',9,86,.90,{}, {movers:2,bomb:2,variableMove:true});
    add('잭팟 챔피언','CASINO_FINAL',10,90,.90,{jackpot:[2]},{movers:3,poison:3,bomb:3});

    add('한 개부터','FARM_PIN1',8,72,.80,{pin:[1]},{wood:35});
    add('두 줄 울타리','FARM_PIN2',8,76,.80,{pin:[1,1]},{wood:40});
    add('트리플 스트라이크','FARM_PIN3',9,82,.85,{pin:[1,1,1]},{wood:30,bomb:3});
    add('움직이는 울타리','FARM_MOVE',9,86,.85,{pin:[1,1,1]},{movers:1,wood:25,poison:2});
    add('캔디 파이브','FARM_FINAL',10,92,.90,{pin:[1,1,1,1,1]},{wood:25,bomb:4,poison:3});

    add('불을 끄세요','CLUB_NEON',8,74,.85,{}, {neon:50});
    add('전기 박자','CLUB_CHAIN',9,80,.85,{lightningChain:1},{neon:55,lightning:2});
    add('하나 둘 셋','CLUB_SQUAT',9,84,.85,{reflect:[1]},{neon:35,squat:true});
    add('리듬 가속','CLUB_FAST',9,88,.90,{reflect:[2]},{neon:35,squat:true,fastSquat:true,movers:1});
    add('점프 앙코르','CLUB_FINAL',10,92,.90,{reflect:[2,2]},{neon:40,squat:true,fastSquat:true,hop:true});

    add('자격 심사','POLICE_TEST',9,82,.90,{}, {jelly:23,wood:17,metal:8,neon:22});
    add('이동 방해 심사','POLICE_BARRIER',9,86,.90,{}, {movers:2,bomb:3,poison:2});
    add('두 종목 연속','POLICE_DUAL',10,90,.85,{soccer:[1],basket:[1]},{jelly:22,metal:8});
    add('종합 실기','POLICE_PRACTICAL',10,94,.85,{pin:[1,1,1],reflect:[2]},{neon:30,lightning:3});
    add('하트 브레이커 우승','POLICE_ENDING',10,96,.90,{heart:[3]},{movers:3,bomb:3,poison:3,lightning:3,jelly:20,wood:20,metal:10,neon:24,heartAfterClear:true});

    function rand(seed) {
        let state = seed >>> 0;
        return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
    }
    // Manually laid out opening circuit: one different venue/mechanic per round.
    // Character codes: S/s solid, J/j jelly, W/w wood, M/m metal, N/n neon.
    // Lowercase chooses that material's second colorway; dots are open lanes.
    // The remaining 32 rounds still use the earlier deterministic prototype
    // layouts until they receive individual art direction.
    const designedBoards={
        MART_BASIC:[
            'SSSs..sSSS','sSSs..sSSs','WWWWWWWWWW','.sSSSSSSs.',
            'SSSs..sSSS','SWWWWWWWWS','.sSSSSSSs.'
        ],
        FARM_PIN1:[
            'W.W.WW.W.W','SSWSSWSSWS','SSsSSSsSSS','sSsSsSsSsS',
            'W.W.WW.W.W','WWWWWWWWWW','SSsSSSsSSS','sSsSsSsSsS'
        ],
        PARK_GOAL1:[
            '..NNJJNN..','.JJSSSSJJ.','NSSWWWWSSN','SSSS..SSSS',
            'SSJJ..JJSS','SSJJMMJJSS','.SSWWWWSS.','SSSSSSSSSS'
        ],
        STUDIO_TAKE1:[
            '.SSSSSSSS.','.sSsSsSsS.','.SSSSSSSS.','.sSsSsSsS.',
            'SSSS..SSSS','sSsSsSsSsS','WWWWWWWWWW','SWWWWWWWWS'
        ],
        ROOM_REVEAL:[
            'SSSS..SSSS','sSSs..sSSs','W.SSSSSS.W','W.sSsSsS.W',
            'WWWW..WWWW','SSSS..SSSS','WSSSSSSSSW','sSsSsSsSsS'
        ],
        CLUB_NEON:[
            'NNN.NN.NNN','nNnNnNnNnN','SSS.SS.SSS','nNnNnNnNnN',
            'NNN.NN.NNN','sSsSsSsSsS','SSSSNSSSSS','SSSSSSSSSS'
        ],
        CASINO_BET:[
            'SSMMSSMMSS','SSSS..SSSS','SSS.SS.SSS','SS.SSSS.SS',
            'SSS.SS.SSS','SSMMSSMMSS','sSsSsSsSsS','SSSSSSSSSS'
        ],
        POLICE_TEST:[
            'NNNN..NNNN','JJWWSSMMNN','JJJ.JJ.JJJ','WWWWMMWWWW',
            'JJ.JJJJ.JJ','nNnNSSnNnN','J.SSSSSS.J','SSMMSSMMSS','SSWWSSWWSS'
        ]
    };
    const materialsByCode={S:'solid',J:'jelly',W:'wood',M:'metal',N:'neon'};
    function decodeDesignedBoard(stage,pattern) {
        if(pattern.length!==stage.rows || pattern.some(row=>row.length!==10))
            throw new Error(`Invalid custom grid size: ${stage.sceneKey}`);
        const result=pattern.map(row=>Array.from(row,token=>{
            if(token==='.')return null;
            const material=materialsByCode[token.toUpperCase()];
            if(!material)throw new Error(`Unknown block material: ${token}`);
            return {material,mark:null,colorway:token===token.toLowerCase()?'alt':'base'};
        }));
        const actual=result.flat().filter(Boolean).length;
        if(actual!==stage.count)throw new Error(`Custom grid count ${stage.sceneKey}: ${actual}/${stage.count}`);
        return result;
    }
    function makeBoard(stage) {
        const crafted=designedBoards[stage.sceneKey];
        if(crafted)return decodeDesignedBoard(stage,crafted);
        const { rows, count, stageId:n, features:f } = stage;
        const random = rand(5821 + n * 7769);
        const board = Array.from({length:rows},()=>Array(10).fill(null));
        const candidates = [];
        for (let r=0;r<rows;r++) for (let c=0;c<10;c++) {
            // Each round has its own recognizable holes/lanes, not a repeated checkerboard.
            const distance = Math.abs(c-4.5), band = (r+n)%4;
            const bias = n%5===0 ? distance*.055 : n%5===1 ? (r%2)*.11 :
                n%5===2 ? (c%3)*.06 : n%5===3 ? Math.abs(r-rows/2)*.035 : band*.025;
            candidates.push({r,c,rank:random()+bias});
        }
        candidates.sort((a,b)=>a.rank-b.rank);
        const chosen = candidates.slice(0,Math.min(rows*10,count));
        const ordered = chosen.slice().sort(()=>random()-.5);
        for (const {r,c} of chosen) board[r][c]={material:'solid',mark:null};
        const remaining = chosen.slice();
        const material = (kind,amount) => {
            const number = typeof amount==='number' ? amount : 0;
            const howMany = kind==='metal' ? (number>30?Math.round(chosen.length*number/100):number) : Math.round(chosen.length*number/100);
            for (let i=0;i<howMany && remaining.length;i++) {
                const pick=Math.floor(random()*remaining.length);
                const at=remaining.splice(pick,1)[0];
                board[at.r][at.c].material=kind;
            }
        };
        // Rare metal is an explicit count; other materials use percentages.
        material('neon',f.neon||0);material('jelly',f.jelly||0);
        material('wood',f.wood||0);material('metal',f.metal||0);
        const unmarked = ordered.slice();
        const mark = (kind,amount) => {
            for(let i=0;i<amount && unmarked.length;i++) {
                const at=unmarked.splice(Math.floor(random()*unmarked.length),1)[0];
                board[at.r][at.c].mark=kind;
            }
        };
        mark('bomb',f.bomb||0);mark('poison',f.poison||0);
        mark('lightning',f.lightning||0);mark('recolor',f.recolor||0);
        if(f.bombChain || stage.objectives.bombChain) {
            // An adjacent pair guarantees the bomb-chain objective is attainable.
            const pair=chosen.find(p=>chosen.some(q=>q.r===p.r && q.c===p.c+1));
            if(pair) {board[pair.r][pair.c].mark='bomb';board[pair.r][pair.c+1].mark='bomb';}
        }
        if(stage.objectives.quickChain) {
            // A bomb surrounded by at least four 1-hit neighbors makes the
            // 1.2-second five-destruction challenge a skill objective, not RNG.
            const center=chosen.find(p=>{
                const around=chosen.filter(q=>Math.hypot(q.r-p.r,q.c-p.c)<=1.5);
                return around.length>=6 && p.r>0 && p.r<rows-1;
            });
            if(center) {
                board[center.r][center.c].mark='bomb';
                board[center.r][center.c].material='solid';
                for(const q of chosen.filter(q=>Math.hypot(q.r-center.r,q.c-center.c)<=1.5).slice(0,5))
                    board[q.r][q.c].material='solid';
            }
        }
        return board;
    }
    // Each batch of eight visits every location once. Difficulty 1→5 advances
    // across the city instead of making the player stay five rounds in a row
    // at the same venue. Final round still ends at the police station.
    const circuit=[
        [0,5,1,3,2,6,4,7],
        [1,0,6,2,5,4,3,7],
        [5,2,0,4,3,1,7,6],
        [4,1,3,5,6,2,0,7],
        [0,2,3,4,5,1,6,7]
    ];
    const mixed=[];
    for(let difficulty=0;difficulty<5;difficulty++) {
        for(const venueIndex of circuit[difficulty]) {
            const source=data[venueIndex*5+difficulty];
            const stageId=mixed.length+1;
            mixed.push({...source,id:stageId,stageId,
                chapter:venueIndex,tier:difficulty+1,
                ballSpeed:3.8+difficulty*.31+(stageId-1)%8*.055});
        }
    }
    window.GAIA_40_STAGES = mixed.map(stage => ({...stage, bricks:makeBoard(stage)}));
})();
