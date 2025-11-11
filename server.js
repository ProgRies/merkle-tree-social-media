import express from "express";
import fs from "fs";
import csv from "csv-parser";
import { MerkleTree } from "merkletreejs";
import crypto from "crypto";
import { MeshWallet, MeshTxBuilder, YaciProvider } from "@meshsdk/core";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static("public"));

// 🔹 SHA256 helper
function sha256(data) {
  return crypto.createHash("sha256").update(data).digest();
}

// =======================================================
// 🔹 Utility: Load hashes from CSV
// =======================================================
async function readHashesFromCSV() {
  return new Promise((resolve, reject) => {
    const hashes = [];
    fs.createReadStream("example_posts_hashes.csv")
      .pipe(csv({ headers: ["hash"], skipLines: 0 }))
      .on("data", (row) => {
        if (row.hash) hashes.push(row.hash.trim());
      })
      .on("end", () => resolve(hashes))
      .on("error", reject);
  });
}

// =======================================================
// 🔹 Endpoint: Get all hashes + Merkle Root
// =======================================================
app.get("/generate-merkle", async (req, res) => {
  try {
    const hashes = await readHashesFromCSV();

    if (hashes.length === 0) {
      return res.status(400).json({ error: "No hashes found in CSV." });
    }

    const leaves = hashes.map((x) => sha256(x));
    const tree = new MerkleTree(leaves, sha256);
    const merkleRoot = tree.getRoot().toString("hex");

    res.json({
      hashes,
      merkleRoot,
      levels: tree.getLayers().map((layer) =>
        layer.map((node) => node.toString("hex"))
      ),
    });
  } catch (err) {
    console.error("Error generating merkle root:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// =======================================================
// 🔹 Function: Archive Merkle Root on-chain
// =======================================================
async function archiveToBlockchain(archive_hash, timestamp) {
  const provider = new YaciProvider("http://localhost:8080/api/v1/");

  const mnemonic = [
    INSERT_YOUR_VALUES_HERE
  ];

  const wallet = new MeshWallet({
    networkId: 0,
    fetcher: provider,
    submitter: provider,
    key: { type: "mnemonic", words: mnemonic },
  });

  const address =
    "INSERT_CHANGEADDRESS_HERE";
  const utxos = await provider.fetchAddressUTxOs(address);

  const label = 78243; // "stage" in t9
  const metadata = {
    [label]: {
      type: "stage.bio",
      archive_hash,
      timestamp,
    },
  };

  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    verbose: true,
  });

  const unsignedTx = await txBuilder
    .changeAddress(address)
    .metadataValue(label, metadata)
    .selectUtxosFrom(utxos)
    .complete();

  const signedTx = await wallet.signTx(unsignedTx);
  const txHash = await wallet.submitTx(signedTx);

  return { txHash, metadata };
}

// =======================================================
// 🔹 Endpoint: Archive route
// =======================================================
app.post("/archive", async (req, res) => {
  try {
    const { archive_hash, timestamp } = req.body;

    if (!archive_hash || !timestamp) {
      return res
        .status(400)
        .json({ error: "Missing archive_hash or timestamp" });
    }

    const { txHash, metadata } = await archiveToBlockchain(
      archive_hash,
      timestamp
    );

    res.json({
      message: "Archive completed successfully!",
      txHash,
      metadata,
    });
  } catch (err) {
    console.error("Error archiving:", err);
    res.status(500).json({ error: "Blockchain archive failed." });
  }
});

app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
