import * as https from 'https'
import * as url from 'url'
import * as fs from 'fs'
import * as path from 'path'

enum Network {
  MAINNET = 'mainnet',
  ROPSTEN = 'ropsten',
  GOERLI = 'goerli'
}
enum ContractName {
  MANAToken = 'MANAToken',
  ERC721Bid = 'ERC721Bid',
  LANDProxy = 'LANDProxy',
  EstateProxy = 'EstateProxy',
  MarketplaceProxy = 'MarketplaceProxy',
  DCLRegistrar = 'DCLRegistrar'
}
type ContractsResponse = Record<Network, Record<ContractName, string>>

const contractsByNetwork = {
  [Network.ROPSTEN]: {
    MANAToken : "0xe40795abd10e724c09c5129484461af2aae776c4",
    LANDProxy: "0xbb265dcc3781f241b586bbbbafe48f0bc140c966",
    MarketplaceProxy: "0xeaf250ce039ed54c3182c2302f69a89017ab36c8",
    EstateProxy: "0xcab66b458910ae5b60a35f737d8551cd2dcd0030",
    ERC721Bid: "0xc732e06d5d3fa1293ccdb7f73cfd6407b3f4f19b",
    DCLRegistrar: "0x7d6d05c82c4ec9600afe9fdea422cd9055877914",
  },
  [Network.MAINNET]: {
      MANAToken : "0x0f5d2fb29fb7d3cfee444a200298f468908cc942",
      LANDProxy: "0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d",
      MarketplaceProxy: "0x8e5660b4ab70168b5a6feea0e0315cb49c8cd539",
      EstateProxy: "0x959e104e1a4db6317fa58f8295f586e1a978c297",
      ERC721Bid: "0xe479dfd9664c693b2e2992300930b00bfde08233",
      DCLRegistrar: "0x2a187453064356c898cae034eaed119e1663acb8",
}
}


const startBlockByNetwork: Record<Network, Record<ContractName, number>> = {
  [Network.MAINNET]: {
    MANAToken: 4162050,
    ERC721Bid: 7270906,
    LANDProxy: 4944642,
    EstateProxy: 6236547,
    MarketplaceProxy: 6496012,
    DCLRegistrar: 9412979
  },
  [Network.ROPSTEN]: {
    MANAToken: 1891200,
    ERC721Bid: 5058246,
    LANDProxy: 2482847,
    EstateProxy: 3890399,
    MarketplaceProxy: 4202120,
    DCLRegistrar: 7170497
  },
  [Network.GOERLI]: {
    MANAToken: 4045806,
    ERC721Bid: 7098754,
    LANDProxy: 7059003,
    EstateProxy: 7059236,
    MarketplaceProxy: 7097561,
    DCLRegistrar: 7098224
  }
}

const contractNameToProxy: Record<string, ContractName> = {
  MANAToken: ContractName.MANAToken,
  LANDRegistry: ContractName.LANDProxy,
  EstateRegistry: ContractName.EstateProxy,
  Marketplace: ContractName.MarketplaceProxy
}

// TODO: Handle ctrl+C
async function build() {
  const network = getNetwork()
  const basePath = path.resolve(__dirname, '../')

  const ethereum = new Ethereum(network)
  await ethereum.fetchContracts()

  const template = new TemplateFile(ethereum)

  await Promise.all([
    template.write(
      `${basePath}/src/data/.addresses.ts`,
      `${basePath}/src/data/addresses.ts`
    ),
    template.write(`${basePath}/.subgraph.yaml`, `${basePath}/subgraph.yaml`)
  ])
}

// ------------------------------------------------------------------
// Parser -----------------------------------------------------------

class TemplateFile {
  constructor(public ethereum: Ethereum) {}

  async write(src: string, destination: string) {
    const contents = await readFile(src)

    try {
      const newContents = new Parser(contents, this.ethereum).parse()

      await writeFile(destination, newContents)
    } catch (error) {
      await deleteFile(destination)
      throw error
    }
  }
}

class Ethereum {
  network: Network

  contractAddresses: Record<ContractName, string>
  startBlocks: Record<ContractName, number>

  constructor(network: Network) {
    this.network = network
    this.startBlocks = startBlockByNetwork[network]
  }

  async fetchContracts() {
    // const contractsByNetwork: ContractsResponse = await fetch(
    //   'https://contracts.decentraland.org/addresses.json'
    // )
    this.contractAddresses = contractsByNetwork[this.network]
  }

  getAddress(contractName: string) {
    return (
      this.contractAddresses[this.getProxyContractName(contractName)] ||
      this.getDefaultAddress()
    )
  }

  getStartBlock(contractName: string) {
    return (
      this.startBlocks[this.getProxyContractName(contractName)] ||
      this.getDefaultStartBlock()
    )
  }

  private getProxyContractName(contractName: string) {
    return contractNameToProxy[contractName] || contractName
  }

  private getDefaultAddress() {
    return '0x0000000000000000000000000000000000000000'
  }

  private getDefaultStartBlock() {
    return 0
  }
}

class Parser {
  constructor(public text: string, public ethereum: Ethereum) {}

  parse() {
    let newText = this.replaceNetworks(this.text)
    newText = this.replaceAddresses(newText)
    newText = this.replaceStartBlocks(newText)
    return newText
  }

  replaceAddresses(text = this.text) {
    for (const placeholder of this.getPlaceholders('address')) {
      const contractName = this.getPlaceholderValue(placeholder)
      const address = this.ethereum.getAddress(contractName).toLowerCase()
      text = text.replace(placeholder, address)
    }
    return text
  }

  replaceStartBlocks(text = this.text) {
    for (const placeholder of this.getPlaceholders('startBlock')) {
      const contractName = this.getPlaceholderValue(placeholder)
      const startBlock = this.ethereum.getStartBlock(contractName)
      text = text.replace(placeholder, startBlock.toString())
    }
    return text
  }

  replaceNetworks(text = this.text) {
    return text.replace(/{{network}}/g, this.ethereum.network)
  }

  getPlaceholders(name: string, text = this.text) {
    const regexp = new RegExp(`{{${name}\:[a-zA-Z0-9]+}}`, 'g')
    return text.match(regexp) || []
  }

  getPlaceholderValue(placeholder: string) {
    // Example: {{operator:value}}
    const [_, value] = placeholder.replace(/{|}/g, '').split(':')
    return value
  }
}

// ------------------------------------------------------------------
// HTTPS ------------------------------------------------------------

async function fetch(uri: string, method = 'GET'): Promise<any> {
  const { protocol, hostname, path } = url.parse(uri)

  if (protocol !== 'https:') {
    throw new Error('Only https is supported')
  }

  const options = {
    hostname,
    method,
    port: 443,
    path
  }
  return new Promise(function(resolve, reject) {
    const req = https.request(options, function(res) {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`Invalid request: ${res.statusCode}`))
      }

      let body = []
      res.on('data', chunk => body.push(chunk))

      res.on('end', () => {
        try {
          body = JSON.parse(Buffer.concat(body).toString())
          resolve(body)
        } catch (e) {
          reject(e)
        }
      })
    })

    req.on('error', err => reject(err))
    req.end()
  })
}

// ------------------------------------------------------------------
// File -------------------------------------------------------------

async function readFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf-8', (err, data) =>
      err ? reject(err) : resolve(data)
    )
  })
}

async function deleteFile(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(path)) {
      resolve()
    }
    fs.unlink(path, err => (err ? reject(err) : resolve()))
  })
}

async function writeFile(path: string, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, data, 'utf-8', err => (err ? reject(err) : resolve()))
  })
}

// ------------------------------------------------------------------
// Args -------------------------------------------------------------

function getNetwork() {
  let network: Network = process.env.ETHEREUM_NETWORK as Network

  if (!network) {
    for (let i = 0; i < process.argv.length; i++) {
      if (process.argv[i] === '--network') {
        network = process.argv[i + 1] as Network
        break
      }
    }
  }

  if (!network || !Object.values(Network).includes(network)) {
    throw new Error(
      "Supply a valid network using --network. Use `npm run build -- --network mainnet` if you're using npm"
    )
  }
  return network
}

build().then(() => console.log('All done'))
