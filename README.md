# tmyxer
### A native open source coin mixer on the Stellar network, also available on Radicle)
Also available on [radicle](https://app.radicle.xyz/seeds/pine.radicle.garden/rad:git:hnrkp5jgfxwxrffjsp148fyzdc457pa9ja38y/tree)

[currently only on TESTNET] 


## Introduction
Coin mixers allow its users to anonymize the provenance of the coins in their balance. This is possible thanks to Zero Knowledge proofs, which allow a prover to prove the validity of their inputs without actually revealing them.

Tmyxer (with the "t" before since it was initially intended to run on Stellar Turrets, and still follows some of their design principles) is a reference implementation of a coin mixer that uses the groth16 verifier algorithm to verify proofs and allow users to anonimize their withdrawals.

## Specification
The mixer is designed to store the least possible amount of data, and leverages the fact that provided inputs aren't actually in the form of transactions (aren't stored) to only store a hash for both nonces (nullifiers) and contract states and match them agains the hashed inputs to verify their validity. For example, when withdrawing, users have to provide the list of used nonces `[n_1, n_2, n_3, n_4]` which is then hashed and matched against the hash stored on-chain. This allows us to store a small amount of data without needing to implement things like merkle proofs or caluk.

Since knowing all previous states is required to deposit (matching the hash against the one stored on-chain) and knowing all previous nonces is required to withdraw, and since we are not invoking the contract through a transaction, we need to store on-chain at least all the latest additions to the state and the nonces, so we can retrieve the correct states and nonces to match against the stored hashes.

To wrap it all up, the state of the contract changes each time we either deposit or withdraw with valid inputs (which also limits the noise we create on-chain), and the updated state when we deposit will look like this:

```
STATE_I
- hash(k) = hash(k + I_k)   | where k is the list of the added coins, and I_k is the coin we are depositing
- hash(n)                   | where n is the list of used nonces
- latest_k = I_k            | where latest_k is the previously deposited coin 
- latest_n                  | where latest_n is the previously deposited nonce
- balance += 100XLM 
...                         | all the other state changes that occurr to an account after a new tx
```

And the updated state when we withdraw looks like this:

```
STATE_I
- hash(k)
- hash(n) = hash(n + I_n)   | where I_n is the nonce we are using for the withdrawal
- latest_k
- latest_n = I_n
- balance -= (100 - fee)XLM 
...
```

To get started with depositing and withdrawing your assets, you'll need:
- two arrays (`[16;int]`), we call them `i` and `j`.
- the hash array of `hash(i, j)`, we call it `k` (the coin).
- the hash array of `hash(i)`, we call it `n` (the nonce/nullifier).
- the constructed proof
- the correct state of the contract

However, the UI will spare you most of the job, so you'll only need `i` and `j` (and a sufficient balance) to deposit and withdraw your funds.

### Proof verification
The proofs are verified with a WebAssembly verifier ( https://github.com/heytdep/wasm-groth16-verifier/ ). The verifier implements the groth16 verification algorithm over BLS_12_377 curves and verifies the following equation:


$(P_a \times P_b) \times (L_i \times (−VK_{\gamma})) \times (P_c \times (−VK_{\delta})) = VK_{\alpha} \times VK_{\beta}$

Where  $(A \times B)$ is the pairing for $A$ and $B$, which is computed using the miller loop algorithm, which is the most optimized way of computing a bilinear and non-degenerate elliptic curve pairing. ( https://heytdep.github.io/comp_posts/4)--priv)--Personal-notes-on-Elliptic-curve-pairings/post.html#computing-pairings-with-miller's-algorithm )


## Limits
Given what has recentely happened with TornadoCash, this implementation acts more like a proof-of-concept mixer that only allows up to 100 deposits (the verification fails otherwise) of 100 lumens (currently about $10.10). This might change in the future.


# Guide
We will provide a user-friendly interface soon which will allow users to deposit and withdraw funds easily. In the meantime, if you'd like to test the mixer out below here there are some "raw" instructions to make deposits and withdrawals.

## Deposit
In order to make a deposit, you'll have to invoke the function thorugh an HTTP request, which will return a signed XDR you'll have to sign and submit as long as there is no invalid input.
To invoke the contract, you'll have to make a POST request to `https://faas-fra1-afec6ce7.doserverless.co/api/v1/web/fn-b81001b9-80a5-4365-90f5-0ea933d10589/tmyxer/run`, with the following JSON body:

```json
{
  "action": "deposit",
  "timebounds": {
    "minTime": min_ts,
    "maxTime": max_ts
  },
  "fee": fee,
  "from": user_who_is_depositing,
  "r": [current_hash_root_state],
  "k": [hash(i, j)]
}
```

To obtain the current hash root state, you can query horizon for manageData operations that start with `k-` ( https://github.com/Xycloo/tmyxer/blob/main/function/packages/tmyxer/run/run.js#L376 , https://github.com/Xycloo/tmyxer/blob/main/function/packages/tmyxer/run/run.js#L368), and build a bidimensional array (i.e `[[latest_k-2], [latest_k-1], [latest_k]]`). The hash array (`hash(i, h)`) can be obtained with the following JS snippet (after installing `zokrates-js` with `npm install zokrates-js`) from https://github.com/Xycloo/tmyxer/blob/main/dev/build_invokation.js#L103 :

```javascript
const { initialize } = require('zokrates-js')

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
```

## Withdraw
To withdraw your funds, make a POST request to the same `https://faas-fra1-afec6ce7.doserverless.co/api/v1/web/fn-b81001b9-80a5-4365-90f5-0ea933d10589/tmyxer/run` contract invokation endpoint with the following JSON body:

```json
{
  "action": "widthdraw",
  "timebounds": {
    "minTime": min_ts,
    "maxTime": max_ts
  },
  "fee": fee,
  "to": user_receiving_the_funds,
  "n_list": list_of_used_nonces,
  proof
]
```

To build the proof, you can use the `build_proof()` function defined [here](https://github.com/Xycloo/tmyxer/blob/main/dev/build_invokation.js#L52).
Here's an example:

```javascript

async function test() {
	// the same i, j secrets we used to compute the hash of the coin we deposited
    const i = ["01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01"];
    const j = ["11", "10", "10", "10", "10", "10", "10", "10", "10", "10", "10", "10", "10", "10", "10", "10"];

    const hashes = await build_hash(i, j);
    const k = JSON.parse(hashes)[0];
    const n = JSON.parse(hashes)[1];

	// root consists of all the deposited coins (k), including the one we are verifying | must have a fixed length of 100. 
    const root = [["0xe661230c","0xe97a637d","0xa4568cad","0xc3c16f82","0xf1734751","0x0d7fcd56","0x53e8941f","0x4e1762de"],["0x06f6e530","0x9ca863bc","0x67af3041","0x85cfbdb3","0x5e960a2b","0x9757fa27","0xfc075d00","0x80dbb1c8"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0"],["0x2cf46708","0x3e53cdde","0xbb50f4b8","0x05fc19f3","0xf4560223","0xa6ea2dd7","0x6218bbfe","0xaa2add4a"]]

    const proof = await build_proof(i, j, k, n, root);
    console.log(proof);
}
```

## Full anonymity
Thanks to our ZK-proofs, there is indeed no way to bind a withdrawal to a deposit, your funds will be withdrawn in full anonymity. However, you might reveal information about your identity, if you withdraw for example, immediately after having deposited, an observer will assume that the one who deposited and the one who withdraws are indeed the same entity.
Also, you may not be completely anonymous if you don't hide your IP address when invoking the contract (DigitalOcean can track your address).

#### This is a [Xycloo](https://xycloo.com/) project.
