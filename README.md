# 環境建置
## 程式＆版本
* Node.js：11.6.0
* Ganache-CLI：6.2.5(2.3.3)
* Truffle：4.1.14(0.4.24)
* package.json中的solidity-util(commit hash)：25efb279ee502b395c669e86cf704f67627e30de

# 程式架構
## Core
* smart_contract：透過Ethereum的smart contract所實作的三大系統
* testTCP：雛型系統之節點部份的實作，透過TCP進行資料傳送
  * Node.js：定義節點所使用的各種函式
  * index.js：程式的進入點，透過Node.js模擬出多個節點，並進行資料傳輸
  * runSingleNode.sh：運行多個singleNode.js以進行測試
  * singleNode.js：和index.js的差異在於，每一個節點，都會是一個獨立的process

## Test
* temp：各種小實驗
* testUDP：測試使用UDP進行資料傳送

# 運行程式
1. 執行Ganache-CLI，`ganache-cli -a <節點總數>`
2. cd至smart_contract，編譯及佈署智能合約，`truffle migrate`
3. cd至testTCP，運行雛型系統，`node index.js`  
※ 運行單一節點模式的測試，`./runSingleNode.sh`(請確保該檔案具有執行權限)
