# tmyxer
### A coin mixer on the Stellar network


## Introduction
Coin mixers allow its users to anonymize the provenance of the coins in their balance. This is possible thanks to Zero Knowledge proofs, which allow a prover to prove the validity of their inputs without actually revealing them.

Tmyxer (with the "t" before since it was initially intended to run on Stellar Turrets, and still follows some of their design principles) is a reference implementation of a coin mixer that uses the groth16 verifier algorithm to verify proofs and allow users to anonimize their widthdrawals.


## Important
Given what has recentely happened with TornadoCash, this implementation acts more like a proof-of-concept mixer that only allows up to 100 deposits (the verification fails otherwise) of 10 lumens (currently about $1.10). This might change in the future.





