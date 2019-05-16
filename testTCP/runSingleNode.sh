# node singleNode.js node0 3000 0 node1 Exit 127.0.0.1 4000 2000 100 10

nodeID=(node0 node1 node2 node3 node4 node5)
nodePort=(3000 4000 5000 6000 7000 8000)
relayType=(Exit Exit Gateway Entry Entry)
checkerID=(checker0 checker1)
checkerPort=(9000 10000)

BEGIN=0
END=5
for ((i=$BEGIN; i<=$END; i++))
do
  if [ $i -lt 3 ]; then
    node singleNode.js ${nodeID[i]} ${nodePort[i]} $i ${nodeID[i+1]} ${relayType[i]} 127.0.0.1 ${nodePort[i+1]} 2000 100 10 &
  elif [ $i -eq 3 ]; then
    node singleNode.js ${nodeID[i]} ${nodePort[i]} $i &
  else
    node singleNode.js ${nodeID[i]} ${nodePort[i]} $i ${nodeID[i-1]} ${relayType[i-1]} 127.0.0.1 ${nodePort[i-1]} 2000 100 10 &
  fi
  sleep 0.5
done

BEGIN=0
END=1
for ((i=$BEGIN; i<=$END; i++))
do
  node singleNode.js ${checkerID[i]} ${checkerPort[i]} $((i+${#nodeID[@]})) &
  sleep 0.5
done

wait $(jobs -p)
echo "*Simulation Finish*"
