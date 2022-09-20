# tmyxer
### A native and open coin mixer on the Stellar network


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
- balance += 10XLM 
...                         | all the other state changes that occurr to an account after a new tx
```

And the updated state when we withdraw looks like this:

```
STATE_I
- hash(k)
- hash(n) = hash(n + I_n)   | where I_n is the nonce we are using for the withdrawal
- latest_k
- latest_n = I_n
- balance -= (10 - fee)XLM 
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
The proofs are verified with a WebAssembly verifier ( https://github.com/heytdep/wasm-groth16-verifier/ ).

## Limits
Given what has recentely happened with TornadoCash, this implementation acts more like a proof-of-concept mixer that only allows up to 100 deposits (the verification fails otherwise) of 10 lumens (currently about $1.10). This might change in the future.


# Guide
We will provide a user-friendly interface soon, in the meantime, if you'd like to test the mixer out below here there are some "raw" instructions to make deposits and withdrawals.

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

To obtain the current hash root state, you can query horizon for manageData operations that start with `k-` ( https://github.com/Xycloo/tmyxer/blob/main/function/packages/tmyxer/run/run.js#L376 ), and build a bidimensional array (i.e `[[latest_k-2], [latest_k-1], [latest_k]]`). The hash array (`hash(i, h)`) can be obtained with the following JS snippet from https://github.com/Xycloo/tmyxer/blob/main/dev/build_invokation.js#L103 :

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


#### This is a [Xycloo](https://xycloo.com/) project.
