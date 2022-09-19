# tmyxer
### A native coin mixer on the Stellar network


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
- two arrays ([8;i64])


## Important
Given what has recentely happened with TornadoCash, this implementation acts more like a proof-of-concept mixer that only allows up to 100 deposits (the verification fails otherwise) of 10 lumens (currently about $1.10). This might change in the future.





