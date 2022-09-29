const simpleSignerUrl = 'https://sign-test.plutodao.finance';

async function invoke() {
    const invokation_body = document.getElementById("invokation").value;
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    const requestOptions = {
	method: 'POST',
	headers: headers,
	body: invokation_body,
	redirect: 'follow'
    };

    fetch("https://faas-fra1-afec6ce7.doserverless.co/api/v1/web/fn-b81001b9-80a5-4365-90f5-0ea933d10589/tmyxer/run", requestOptions)
	.then(response => response.json())
	.then(result => {
	    const unsignedXdr = result.xdr;

	    document.getElementById("xdr-out").innerText = unsignedXdr;
	    document.getElementById("xdr-wrap").style.background = "#dcdcdc";
	    
	    if (JSON.parse(invokation_body).action == "deposit") {
		document.getElementById("xdr-descr").innerText = "Sign this xdr with your wallet and submit it to the network:";
	    } else {
		document.getElementById("xdr-descr").innerText = "Submit this xdr to the network:";
	    }
	})
	.catch(error => console.log('error', error));
}

async function handleMessage(e) {
    if (
        e.origin !== simpleSignerUrl &&
            e.data.type === 'onSign' &&
            e.data.page === 'sign'
    ) {
	console.log("received message");
        const eventMessage = e.data;

        const signedXdr = eventMessage.message.signedXDR;
        // Validate the XDR, this is just good practice.
        if (
            StellarSdk.xdr.TransactionEnvelope.validateXDR(
                signedXdr,
                'base64',
            )
        ) {
            const server = new StellarSdk.Server(
                'https://horizon-testnet.stellar.org/',
            ); //remember to update this to the correct value

            // Construct the transaction from the signedXDR
            // see https://stellar.github.io/js-stellar-sdk/TransactionBuilder.html#.fromXDR
            const transaction =
                  StellarSdk.TransactionBuilder.fromXDR(
                      signedXdr,
                      'Test SDF Network ; September 2015', //remember to update this to the correct value
                  );

            try {
                const transactionResult =
                      await server.submitTransaction(transaction);
                console.log(transactionResult);
            } catch (err) {
                console.error(err);
            }
        }
    }
}
