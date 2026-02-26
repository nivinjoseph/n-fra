
#!/bin/bash

cat << 'EOF' >> /etc/ecs/ecs.config
ECS_CLUSTER=#{mongoClusterName}
ECS_LOGLEVEL=debug
ECS_AVAILABLE_LOGGING_DRIVERS=["json-file","awslogs","fluentd"]
ECS_ENABLE_CONTAINER_METADATA=true
ECS_ENABLE_AWSLOGS_EXECUTIONROLE_OVERRIDE=true
ECS_ENABLE_TASK_IAM_ROLE=true
EOF

ebsVolumeId="#{ebsVolumeId}"
echo "volume-id: $ebsVolumeId"

architecture=$(uname -m) # potential values: x86_64, aarch64
echo "architecture:$architecture"

if [[ $architecture == "aarch64" ]]
then 
	awscliUrl="https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip"
else 
	awscliUrl="https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip"
fi
echo "awscliUrl:$awscliUrl"


yum install unzip -y
curl "$awscliUrl" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install

instanceMetadataToken=`curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"` 
instance_id=`curl -H "X-aws-ec2-metadata-token: $instanceMetadataToken" -v http://169.254.169.254/latest/meta-data/instance-id`
region=`curl -H "X-aws-ec2-metadata-token: $instanceMetadataToken" -s http://169.254.169.254/latest/dynamic/instance-identity/document | grep -oP '\"region\"[[:space:]]*:[[:space:]]*\"\K[^\"]+'`

/usr/local/bin/aws ec2 detach-volume --volume-id "$ebsVolumeId" --force  > /dev/null 2>&1

while true;
do
    VOLCHECK=`/usr/local/bin/aws ec2 describe-volumes --region $region --volume-id $ebsVolumeId | grep State | awk -F\" '{print $4}'` 
    if [ "${VOLCHECK}" == "available" ] 
    then 
        echo "$(date): Volume is available" 
        break 
    else
        echo "$(date): Volume is not available yet:  ${VOLCHECK}"
        sleep 1
    fi 
done

/usr/local/bin/aws ec2 attach-volume --volume-id $ebsVolumeId --instance-id $instance_id --device /dev/sdb

# waiting for the volume to be in-use status
while true;
do
    VOLCHECK=`/usr/local/bin/aws ec2 describe-volumes --region $region --volume-id $ebsVolumeId | grep State | awk -F\" '{print $4}'` 
    if grep -q "attached.*in-use" <<< $VOLCHECK
    then 
        echo "$(date): Volume is attached and in-use" 
        break 
    else
        echo "$(date): Volume attachment in progress:  ${VOLCHECK}"
        sleep 1
    fi 
done

deviceName=/dev/nvme1n1
isDeviceEmpty=$(sudo file -s $deviceName)
while true
do
    if [ -z "$isDeviceEmpty" ] || grep -q "No such file or directory" <<< $isDeviceEmpty ;
    then
        echo "device not ready yet!: ($isDeviceEmpty)"
        sleep 1
    else
        echo "isDeviceEmpty: ($isDeviceEmpty)"
        break
    fi
    isDeviceEmpty=$(sudo file -s $deviceName)
done
if [[ $isDeviceEmpty == "$deviceName: data" ]]; then
    echo "Device is empty, formatting disk"
    sudo mkfs.xfs $deviceName
    echo "Device is formatted"
else
    echo "Device has been already been formatted"
fi

isEBsMounted=$(df -h | grep /mongodb | awk '{print $6}' | cut -d "/" -f2)
if [ "$isEBsMounted" == "mongodb" ]
then
    echo "EBS is mounted"
else
    [ -d "/mongodb" ] || sudo mkdir -p /mongodb
    uuID=$(sudo blkid -s UUID -o value $deviceName)
    while true
    do
        if [ -z "$uuID" ];
        then
            echo "Waiting for blkid"
            sleep 1
            uuID=$(sudo blkid -s UUID -o value $deviceName)
        else
            echo "uuid: $uuID"
            break
        fi
    done
    echo "UUID=$uuID  /mongodb  xfs  defaults,discard  0  0" | sudo tee -a /etc/fstab
    sudo mount -a
fi
        

# sudo systemctl restart ecs