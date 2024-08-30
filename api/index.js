import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import bs58 from 'bs58'
import * as solanaWeb3 from '@solana/web3.js'
import { Xcrow } from '@xcrowdev/node'

const app = express()
const port = 3333

const xcrow = new Xcrow({
  apiKey: process.env.XCROW_API_KEY,
  applicationId: process.env.XCROW_APPLICATION_ID,
})

app.use(express.json())
app.use(cors())

app.post('/create-vault', async (req, res) => {
  const init = await xcrow.createVault({
    payer: 'FRyeXUJWxCnBLcrdgfP1KzsCCmPWRxDmEMM31zno3LtV',
    strategy: 'blockhash',
    priorityFeeLevel: 'Medium',
    token: {
      mintAddress: 'So11111111111111111111111111111111111111112',
    },
    network: 'devnet',
  });

  const signedTransaction = await signTransaction(
    init.serializedTransaction,
    process.env.PRIVATE_KEY,
  );

  await xcrow.execute({
    vaultId: init.vaultId,
    transactionId: init.transactionId,
    signedTransaction,
  });

  return res.json({ message: 'Vault created', vaultId: init.vaultId })
})

app.post('/deposit/:vaultId', async (req, res) => {
  const { vaultId } = req.params;
  const body = req.body;

  const deposit = await xcrow.deposit({
    payer: body.address,
    strategy: 'blockhash',
    priorityFeeLevel: 'Medium',
    vaultId: vaultId,
    token: {
      mintAddress: 'So11111111111111111111111111111111111111112',
      amount: 0.01,
    },
    network: 'devnet',
  });

  const serializedTransactionDeposit =
    solanaWeb3.VersionedTransaction.deserialize(
      Buffer.from(deposit.serializedTransaction, 'base64'),
    );
  serializedTransactionDeposit.sign([
    solanaWeb3.Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY)), // private key of the vault creator
  ]);

  const ser = Buffer.from(serializedTransactionDeposit.serialize()).toString(
    'base64',
  );

  return res.json({ serializedTransaction: ser, transactionId: deposit.transactionId })
});

app.post('/execute', async (req, res) => {
  const body = req.body;

  await xcrow.execute({
    vaultId: body.vaultId,
    transactionId: body.transactionId,
    signedTransaction: body.signedTransaction,
  });

  return res.json({ message: 'Transaction executed' })
})

app.listen(port, () => {
  console.log(`listening on port ${port}`)
})

async function signTransaction(
  serializedTransaction,
  secretKey,
) {
  const secretKeyBytes = bs58.decode(secretKey);

  const keypair = solanaWeb3.Keypair.fromSecretKey(secretKeyBytes);

  const transaction = solanaWeb3.Transaction.from(
    Buffer.from(serializedTransaction, 'base64'),
  );
  // console.log(transaction.signatures);
  transaction.partialSign(keypair);

  const signedTransaction = transaction.serialize().toString('base64');

  return signedTransaction;
}