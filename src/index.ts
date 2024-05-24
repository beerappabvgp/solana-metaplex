import { initializeKeypair } from "./initializeKeypair"
import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js"
import {
  Metaplex,
  keypairIdentity,
  bundlrStorage,
  toMetaplexFile,
  NftWithToken,
} from "@metaplex-foundation/js"
import * as fs from "fs"

interface NftData {
  name: string
  symbol: string
  description: string
  sellerFeeBasisPoints: number
  imageFile: string
}

// example data for a new NFT
const nftData = {
  name: "Name",
  symbol: "SYMBOL",
  description: "Description",
  sellerFeeBasisPoints: 0,
  imageFile: "solana.png",
}


// example data for updating an existing NFT
const updateNftData = {
  name: "Update",
  symbol: "UPDATE",
  description: "Update Description",
  sellerFeeBasisPoints: 100,
  imageFile: "success.png",
}

async function main() {
  // create a new connection to the cluster's API
  const connection = new Connection(clusterApiUrl("devnet"))

  // initialize a keypair for the user
  const user = await initializeKeypair(connection)
  const collectionNftData = {
    name: "TestCollectionNFT",
    symbol: "TEST",
    description: "Test Description Collection",
    sellerFeeBasisPoints: 100,
    imageFile: "success.png",
    isCollection: true,
    collectionAuthority: user,
  }

  console.log("PublicKey:", user.publicKey.toBase58())

  //metaplex setup
  const metaplex = Metaplex.make(connection)
      .use(keypairIdentity(user))
      .use(bundlrStorage({
        address: "https://devnet.bundlr.network",
        providerUrl: "https://api.devnet.solana.com",
        timeout: 60000,
      }));

  const uploadMetaData = async (metaplex : Metaplex , nftData: NftData): Promise<string> => {
      const buffer = fs.readFileSync("src/" + nftData.imageFile);
      // buffer to metaplex file
      const file = toMetaplexFile(buffer , nftData.imageFile);
      const imageUri = await metaplex.storage().upload(file);
      console.log("Image uri: " , imageUri);
      // off chain metadata
      const { uri } = await metaplex.nfts().uploadMetadata({
        name: nftData.name,
        symbol: nftData.symbol,
        description: nftData.description,
        image: imageUri,
      });
      console.log("metadata uri: " , uri);
      return uri;
  }

  let collectionMint: PublicKey;

  const createNft = async (metaplex : Metaplex , nftData : NftData , uri: string) : Promise<NftWithToken> => {
    const { nft } = await metaplex.nfts().create(
      {
      uri: uri,
      name: nftData.name,
      sellerFeeBasisPoints: nftData.sellerFeeBasisPoints,
      symbol: nftData.symbol,
      },
      {
        commitment: "finalized",
      }
    );
    console.log(
      `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`,
    );

    await metaplex.nfts().verifyCollection({
      mintAddress: nft.mint.address,
      collectionMintAddress: collectionMint,
      isSizedCollection: true,
    });
  
    return nft;
  }

  const uri = await uploadMetaData(metaplex , nftData);
  const nft = await createNft(metaplex , nftData , uri);

  const updateNftUri = async (metaplex: Metaplex , uri: string , mintAddress : PublicKey) => {
    const nft = await metaplex.nfts().findByMint({mintAddress});
    const response = await metaplex.nfts().update(
      {
        nftOrSft: nft,
        uri: uri,
      },
      {
        commitment: "finalized",
      }
    );
    console.log(
      `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`,
    );
  
    console.log(
      `Transaction: https://explorer.solana.com/tx/${response.signature}?cluster=devnet`,
    );
  }


  const updatedUri =  await uploadMetaData(
    metaplex, updateNftData
  );

  await updateNftUri(metaplex , updatedUri , nft.address);

  // creating collections of nfts

  const createCollectionNft = async (metaplex: Metaplex , uri: string , data:any ): Promise<NftWithToken> => {
      const { nft } = await metaplex.nfts().create({
        uri:uri,
        name: data.name,
        sellerFeeBasisPoints: data.sellerFeeBasisPoints,
        symbol: data.symbol,
        isCollection: true,
      } , 
      {
        commitment : "finalized",
      }
    );
    console.log(
      `Collection Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`
    )
  
    return nft;
  }
  

  const collectionuri = await uploadMetaData(metaplex , collectionNftData);
  const collectionNft = await createCollectionNft(
    metaplex ,
    collectionuri,
    collectionNftData
  );
  collectionMint = collectionNft.address;


}

main()
  .then(() => {
    console.log("Finished successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
