
/***
 *======== HOW TO USE THIS FILE ========
 * 
 *  ***/

import { doZapperTests } from "./../yy-zapper-test";

const tests = [
    {
        name: "JoeAvaxJoeLp",
        yyAddress: "0x377DeD7fDD91a94bc360831DcE398ebEdB82cabA",
    },
    // {
    //     name: "JoeAvaxSnobLp",
    //     snowglobeAddress: "0x8b2E1802A7E0E0c7e1EaE8A7c636058964e21047",
    //     gaugeAddress: "0xbfb39cf60b4598B1EEc796838faF874f6c41289B",
    //     controller: "main"
    // }
];


describe("Yield Yak Joe Zapper Tests", function() {
    for (const test of tests) {
        doZapperTests(
            test.name,
            test.yyAddress,
            "YYTraderJoe"
        );
    }
});
