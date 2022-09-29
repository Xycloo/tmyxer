const simpleSignerUrl = 'https://sign.plutodao.finance';


window.addEventListener("onSign", (e) => {
    console.log(e.message.signedXDR)
})


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
	    let tx = StellarSdk.TransactionBuilder.fromXDR(unsignedXdr, "Test SDF Network ; September 2015");
	    let server = new StellarSdk.Server("https://horizon-testnet.stellar.org");

	    if (JSON.parse(invokation_body).action == "deposit") {
		const signWindow = window.open(
		    `${simpleSignerUrl}/sign?xdr=${unsignedXdr}`,
		    'Sign_Window',
		    'width=360, height=700',
                );
                window.addEventListener('message', (e) => {
		    if (e.origin !== simpleSignerUrl) {
                        return;
		    } else if (e.data.type == "onSign") {
			const signedXdr =  e.data.message.signedXDR;
			console.log("test");
			console.log(signedXdr)

			const transaction =
			      StellarSdk.TransactionBuilder.fromXDR(
				  signedXdr,
				  'Test SDF Network ; September 2015', //remember to update this to the correct value
			      );

			server.submitTransaction(transaction).then(resp => resp.text()).then(out => console.log(out))
		    }
                });
	    } else {
		server.submitTransaction(tx).then(resp => resp.text()).then(out => console.log(out))
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
