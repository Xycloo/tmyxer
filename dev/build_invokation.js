const { initialize } = require('zokrates-js')
const fs = require('fs');
const BigNumber = require('bignumber.js');
const {Server} = require("stellar-sdk");
var fetch = require("node-fetch");
const atob = require("atob");

const server = new Server("https://horizon-testnet.stellar.org");


const get_inputs = async () => {
    let ops = [];
    let endpoint = "https://horizon-testnet.stellar.org/accounts/GDVPTP2V4ORSOMXCVMXULGELBCDIHV23FIX5G3EFKGLERJVRNPPXXNGV/operations?limit=200&order=asc&include_failed=false";
    while (true) {
        let response = await fetch(endpoint);
        let res = await response.json();
        if (res._embedded.records.length == 0) {
            break
        } else {
            for (let n=0; n < res._embedded.records.length; n++) {
                ops.push(res._embedded.records[n])
            }
            endpoint = res._links.next.href
        }
    }
    
    let nonces = [];
    let states = []
    
    for (let i=0; i < ops.length; i++) {
        if (ops[i].type == "manage_data" && ops[i].name.startsWith("k-")) {
	    if (ops[i].name.split("-")[1] == "[" || ops[i].value == "") {
		continue
	    } else {
//		console.log(`${i}: [${ops[i].name.split("-")[1]}, ${atob(ops[i].value)}] ${atob(ops[i].value)}`)
		states.push(JSON.parse(`[${ops[i].name.split("-")[1]}, ${atob(ops[i].value)}]`))
	    }
        }
        
        if (ops[i].type == "manage_data" && ops[i].name.startsWith("n-")) {
	    if (ops[i].name.split("-")[1] == "[") {
		continue
	    } else {
		nonces.push(JSON.parse(`[${ops[i].name.split("-")[1]}, ${atob(ops[i].value)}]`))
	    }
        }
    }

    return {
	"nonces": nonces,
	"states": states
    }
}


function getDecimal(hex) {
    hex = hex.replace("0x",""); 
    hex = hex.replace("0X","");
    const x = new BigNumber(hex, 16);
    
    return x.toString(10);
}

function arrToDecimal(arr) {
    let arr_out = [];
    for (let i=0; i< arr.length; i++) {
	arr_out.push(getDecimal(arr[i]))
    }
    
    return arr_out
}

function getRandom() {
    return Math.floor(Math.random() * 4294967295)
}

const proofParseInto = (obj) => {
    let a_0 = getDecimal(obj.proof.a[0]);
    let a_1 = getDecimal(obj.proof.a[1]);
    
    let b_0 = getDecimal(obj.proof.b[0][0]);
    let b_1 = getDecimal(obj.proof.b[0][1]);
    let b_2 = getDecimal(obj.proof.b[1][0]);
    let b_3 = getDecimal(obj.proof.b[1][1]);
    
    let c_0 = getDecimal(obj.proof.c[0]);
    let c_1 = getDecimal(obj.proof.c[1]);
    
    let pub_i = []
    
    for (n of obj.inputs) {
        pub_i.push(`"${getDecimal(n)}"`)
    }
    
    let out = `"p_a": ["${a_0}", "${a_1}"], "p_b": ["${b_0}", "${b_1}", "${b_2}", "${b_3}"], "p_c": ["${c_0}", "${c_1}"], "pub_i": [${pub_i}]`
    
    return out
}


getProvingKey = () => {
    console.log("[+] Reading Proving Key");
    const file = "../keys/proving.key";
    //console.log('files: ' + file);
    return fs.readFileSync(file)
}


async function build_proof(i, j, k, n, root) {
    const defaultProvider = await initialize()
    let zokratesProvider = defaultProvider.withOptions({ 
        backend: "ark",
        curve: "bls12_377",
        scheme: "g16"
    });
    const code = `
import "hashes/sha256/512bit" as sha256;

def ensure(u32[100][8] r, u32[8] k) -> bool {
    bool mut out = false;

    for u32 i in 0..100 {
        out = if r[i] == k { true } else {out};
    }
    
    return out;
}

def main(private u32[16] i, private u32[16] j, private u32[8] k, u32[8] n, u32[100][8] r) -> bool {
    u32[8] h_c_i = sha256(i[0..8], i[8..16]);
    u32[8] h_c_j = sha256(j[0..8], j[8..16]);
    u32[8] h_c = sha256(h_c_i, h_c_j);

    assert(h_c_i == n);
    assert(h_c == k);
    assert(ensure(r, k));
    return true;
}

    `;
    
    const artifacts = await zokratesProvider.compile(code);
    const { witness, output } = await zokratesProvider.computeWitness(artifacts, [
	// private inputs
	i, // i
	j, // j
	k, // k

	// public inputs
	n, // n
	root
    ]);
    const provingKey = getProvingKey();
    const proof = await zokratesProvider.generateProof(artifacts.program, witness, provingKey);

    return proofParseInto(proof)
}


async function build_hash(i, j) {
    const defaultProvider = await initialize();
    let zokratesProvider = defaultProvider.withOptions({ 
        backend: "ark",
        curve: "bls12_377",
        scheme: "g16"
    });
    const code = `
import "hashes/sha256/512bit" as sha256;

def main(private u32[16] i, private u32[16] j) -> (u32[8], u32[8]) {
    u32[8] h_c_i = sha256(i[0..8], i[8..16]);
    u32[8] h_c_j = sha256(j[0..8], j[8..16]);
    u32[8] h_c = sha256(h_c_i, h_c_j);

    return (h_c, h_c_i);
}

    `;
    
    const artifacts = await zokratesProvider.compile(code);
    const { witness, output } = await zokratesProvider.computeWitness(artifacts, [
	i,
	j
    ]);
    
    return output

}


async function test() {
    const i = ["1", "01", "01", "01", "1", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01"];
    const j = ["0", "10", "10", "10", "0", "10", "10", "10", "10", "10", "10", "10", "10", "10", "10", "10"];

    const hashes = await build_hash(i, j);
    const k = JSON.parse(hashes)[0];
    const n = JSON.parse(hashes)[1];

    let {nonces, states} = await get_inputs();
    
    const states_len = states.length;

    for (let n = 0; i < states_len; n++) {}
    
    for (let i = 0; i < 99 - states_len; i++) {
	states.push(["0","0","0","0","0","0","0","0"])
    }
//    states.push(k);

    console.log(JSON.stringify(states[1]));
    /*
    const root = [
	// all previous coins
	["0xe661230c","0xe97a637d","0xa4568cad","0xc3c16f82","0xf1734751","0x0d7fcd56","0x53e8941f","0x4e1762de"],
	["0x06f6e530","0x9ca863bc","0x67af3041","0x85cfbdb3","0x5e960a2b","0x9757fa27","0xfc075d00","0x80dbb1c8"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],
	["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],
	["0x2cf46708","0x3e53cdde","0xbb50f4b8","0x05fc19f3","0xf4560223","0xa6ea2dd7","0x6218bbfe","0xaa2add4a"] // coin we are verifiying
	]
	*/

    //    const proof = await build_proof(i, j, k, n, states);
    let r = states.filter(state => JSON.stringify(state) != "[\"0\",\"0\",\"0\",\"0\",\"0\",\"0\",\"0\",\"0\"]");

    const from = "GCHSWYTYMIWYZXBQPMHRBPSXI3D4JFSZZSNA64R4M75ICJCZXZHI5UIT";
    const out = `{
"action": "deposit",
  "timebounds": {
    "minTime": "1663002743",
    "maxTime": "1693004054"
  },
"fee": "5000",
"from": ${from},
"k": ${JSON.stringify(arrToDecimal(k))},
"r": ${JSON.stringify(r)}
}`
    console.log(out);
}

//test();

async function deposit(i, j, from) {
//    const i = ["1", "01", "01", "01", "1", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01"];
//    const j = ["0", "10", "10", "10", "0", "10", "10", "10", "10", "10", "10", "10", "10", "10", "10", "10"];

    const hashes = await build_hash(i, j);
    const k = JSON.parse(hashes)[0];
    const n = JSON.parse(hashes)[1];

    let {nonces, states} = await get_inputs();
    
    const states_len = states.length;

    for (let n = 0; i < states_len; n++) {}
    
    for (let i = 0; i < 99 - states_len; i++) {
	states.push(["0","0","0","0","0","0","0","0"])
    }
    let r = states.filter(state => JSON.stringify(state) != "[\"0\",\"0\",\"0\",\"0\",\"0\",\"0\",\"0\",\"0\"]");

    const out = `
Deposit details: \n
* i (keep it secret!): ${i}
* j (keep it secret!): ${j}
* k (coin, public): ${k}
* n (nullifier, public after withdrawing): ${n}
`
    const body = `{
  "action": "deposit",
    "timebounds": {
      "minTime": "1663002743",
      "maxTime": "1693004054"
    },
  "fee": "5000",
  "from": "${from}",
  "k": ${JSON.stringify(arrToDecimal(k))},
  "r": ${JSON.stringify(r)}
}`
    console.log(out);

    return body
}


async function test_deposit() {

    console.log("[+] Building deposit invokation")
    
    const i = ["1", "01", "01", "01", "1", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01"];
    const j = ["0", "10", "10", "10", "0", "10", "10", "10", "10", "10", "10", "10", "10", "10", "10", "10"];
    const from = "GCHSWYTYMIWYZXBQPMHRBPSXI3D4JFSZZSNA64R4M75ICJCZXZHI5UIT";

    const body = await deposit(i, j, from);
    console.log(body);
}

async function test1_deposit() {

    console.log("[+] Building deposit invokation")
    
    const i = ["1", "11", "01", "01", "1", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01"];
    const j = ["0", "11", "10", "10", "0", "10", "10", "10", "10", "10", "10", "10", "10", "10", "10", "10"];
    const from = "GBX2BWJ6LZI34KEBYVCQW27RPXX6LILODTJBOA7C43OUY4GI2YMA4KZD";

    const body = await deposit(i, j, from);
    console.log(body);
}



//test_deposit();
//test1_deposit();

async function withdraw(i, j, to) {
    let {nonces, states} = await get_inputs();

    const hashes = await build_hash(i, j);
    const k = JSON.parse(hashes)[0];
    const n = JSON.parse(hashes)[1];
    
    const states_len = states.length;

    for (let n = 0; n < states_len; n++) {
	for (let i = 0; i < states[n].length; i++) {
	    states[n][i] = `0x${states[n][i].toString(16)}`
	}
    }
    
    for (let i = 0; i < 100 - states_len; i++) {
	states.push(["0","0","0","0","0","0","0","0"])
    }
    
    const proof = await build_proof(i, j, k, n, states);
    let r = states.filter(state => JSON.stringify(state) != "[\"0\",\"0\",\"0\",\"0\",\"0\",\"0\",\"0\",\"0\"]");

    const out = `
{"action": "widthdraw", "timebounds": { "minTime": "0", "maxTime": "1683004054"}, "fee": "5000", "to": "${to}", "n_list": ${JSON.stringify(nonces)},${proof}}`
    console.log(out);
    return out
}

async function test_withdraw() {

    console.log("[+] Building withdraw invokation")

    const i = ["1", "01", "01", "01", "1", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01"];
    const j = ["0", "10", "10", "10", "0", "10", "10", "10", "10", "10", "10", "10", "10", "10", "10", "10"];
    const to = "GDF4QYITSKDTY3VY4US6CTML26YI6RPTTKGCITD6AFQKSFNT2L4XH36R";
    
    await withdraw(i, j, to);
}

//test_withdraw()

