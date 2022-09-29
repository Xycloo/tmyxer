const {Server} = require("stellar-sdk");
const atob = require("atob");
var fetch = require("node-fetch");

const server = new Server("https://horizon-testnet.stellar.org");

const main = async () => {
    let ops = [];
    let endpoint = "https://horizon-testnet.stellar.org/accounts/GAJVV7RYJA2SAQAJV4NHJMJF7ZUFXV5QJGIZD4LICWUTPE2T2VTZ7VN2/operations?limit=200&order=desc&include_failed=false";
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
	    if (ops[i].name.split("-")[1] == "[") {
		continue
	    } else {
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

    console.log("nonces:");
    console.log(nonces);

    console.log("states:");
    console.log(states);
}

main()
