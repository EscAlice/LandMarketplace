## 部署
> 拉取代码： https://github.com/decentraland/marketplace.git

### 前端：webapp
```
cd webapp
mv .env.example .env
npm install
npm start
```
```
生产构建
package.json page 66
    "build": "CI=false react-scripts build", -->     "build": "set CI=false react-scripts build",
npm run build
npm start
```

```
npm install 报错：
npm ERR! code ERESOLVE
npm ERR! ERESOLVE could not resolve
npm ERR!
npm ERR! While resolving: react-lazy-images@1.1.0
npm ERR! Found: react@17.0.2
npm ERR! node_modules/react
npm ERR!   react@"^17.0.2" from the root project
npm ERR!   peer react@"^16.8.0 || ^17" from @fluentui/react-component-event-listener@0.51.7
npm ERR!   node_modules/@fluentui/react-component-event-listener
npm ERR!     @fluentui/react-component-event-listener@"~0.51.6" from semantic-ui-react@2.1.2
npm ERR!     node_modules/semantic-ui-react
npm ERR!       semantic-ui-react@"^2.0.3" from decentraland-ui@3.40.0
npm ERR!       node_modules/decentraland-ui
npm ERR!         decentraland-ui@"^3.40.0" from the root project
npm ERR!         1 more (decentraland-dapps)
npm ERR!   21 more (@fluentui/react-component-ref, ...)
npm ERR!
npm ERR! Could not resolve dependency:
npm ERR! peer react@"^15 || ^16" from react-lazy-images@1.1.0
npm ERR! node_modules/react-lazy-images
npm ERR!   react-lazy-images@"^1.1.0" from the root project
npm ERR!
npm ERR! Conflicting peer dependency: react@16.14.0
npm ERR! node_modules/react
npm ERR!   peer react@"^15 || ^16" from react-lazy-images@1.1.0
npm ERR!   node_modules/react-lazy-images
npm ERR!     react-lazy-images@"^1.1.0" from the root project
npm ERR!
npm ERR! Fix the upstream dependency conflict, or retry
npm ERR! this command with --force, or --legacy-peer-deps
npm ERR! to accept an incorrect (and potentially broken) dependency resolution.
npm ERR!
npm ERR! See C:\Program Files\nodejs\node_cache\eresolve-report.txt for a full report.

npm ERR! A complete log of this run can be found in:
npm ERR!     C:\Program Files\nodejs\node_cache\_logs\2022-08-15T07_44_46_465Z-debug-0.log
```
> 解决：
 npm config set legacy-peer-deps true


### 后端：indexer
```
cd indexer
/script/buildData.ts
// const contractsByNetwork: ContractsResponse = await fetch(
//  'https://contracts.decentraland.org/addresses.json'
// )
-->
const contractsByNetwork = {
  [Network.ROPSTEN]: {
    MANAToken : "0xe40795abd10e724c09c5129484461af2aae776c4",
    LANDProxy: "0xbb265dcc3781f241b586bbbbafe48f0bc140c966",
    MarketplaceProxy: "0xeaf250ce039ed54c3182c2302f69a89017ab36c8",
    EstateProxy: "0xcab66b458910ae5b60a35f737d8551cd2dcd0030",
    ERC721Bid: "0xc732e06d5d3fa1293ccdb7f73cfd6407b3f4f19b",
    DCLRegistrar: "0xe6f5870b425bbb899676d49dc152cc9f656c6ddb",
  }
}
以上合约地址替换成自己的合约地址
```
```
npm run build-data -- --network ropsten
```

```
/script/deploy.ts
const graphByNetwork: Record<Network, string> = {
  [Network.MAINNET]: process.env.GRAPH_NAME || 'decentraland/marketplace',
  [Network.ROPSTEN]: process.env.GRAPH_NAME || 'decentraland/marketplace-ropsten',
  [Network.GOERLI]:  process.env.GRAPH_NAME || 'decentraland/marketplace-goerli'
}
以上的the graph替换成自己的子图空间
```

```
./indexer/.subgraph.yaml
specVersion: 0.0.2
-->
specVersion: 0.0.4

apiVersion: 0.0.4
-->
apiVersion: 0.0.6
```

```
./indexer/package.json
"@graphprotocol/graph-cli": "^0.21.1",
"@graphprotocol/graph-ts": "^0.19.0",
-->
"@graphprotocol/graph-cli": "0.33.0",
"@graphprotocol/graph-ts": "0.27.0",
```

```
src/handlers/bid.ts
let nft = NFT.load(bid.nft)
-->
let nftId:string = bid.nft as string
let nft = NFT.load(nftId)
```

```
src/handlers/ens.ts
let nft = NFT.load(id)
nft.name = ens.subdomain
nft.searchText = toLowerCase(ens.subdomain)
-->
let nft = NFT.load(id)
if (nft == null) {
  return
}
nft.name = ens.subdomain
nft.searchText = toLowerCase(ens.subdomain!)
```

```
src/handlers/estate.ts
let estate = Estate.load(id)
let parcels = estate.parcels
-->
let estate = Estate.load(id)
if (estate == null) {
  return
}
let parcels = estate.parcels
if (parcels == null) {
  return
}
```

```
src/handlers/marketplace.ts
nft!
order!
-->
nft
order

src/handlers/nft.ts
nft!
-->
nft
```

```
src/handlers/parcel.ts
nft.searchText = getParcelText(parcel, parcelData.name)
-->
let temp: string = parcelData.name as string
nft.searchText = getParcelText(parcel, temp)

src/modules/account/index.ts
return account!
-->
return account
```

```
src/modules/analytics/index.ts
let nft = NFT.load(nftId)
-->
let nft = NFT.load(nftId)
if (nft == null) {
  return
}
```

```
src/modules/nft/index.ts
let oldOrder = Order.load(nft.activeOrder)
-->
let id:string = nft.activeOrder as string
let oldOrder = Order.load(id)
```

```
src/modules/wearable/index.ts
let wearableId = getWearableIdFromTokenURI(nft.tokenURI)
-->
let tokenURI:string = nft.tokenURI as string
let wearableId = getWearableIdFromTokenURI(tokenURI)

nft.tokenURI
-->
tokenURI
```

>初始化子图托管服务：
github 登录 the graph，进入 My Dashboard -- Add Subgraph -- Create a subgraph

```
部署：
npm install -g @graphprotocol/graph-cli@0.33.0
npm install -g @graphprotocol/graph-ts@0.27.0
npm install
npm run codegen
graph auth --product hosted-service <ACCESS_TOKEN>
graph deploy --product hosted-service <GITHUB_USER>/<SUBGRAPH NAME>
```