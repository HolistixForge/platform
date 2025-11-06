# Setup Linux Host for docker access to gpu

## Install cuda and nvidia kernel and modules
https://docs.nvidia.com/cuda/cuda-installation-guide-linux/index.html#network-repo-installation-for-ubuntu

```
sudo apt install -y gcc
sudo apt-key del 7fa2af80
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2404/x86_64/cuda-keyring_1.1-1_all.deb
sudo dpkg -i cuda-keyring_1.1-1_all.deb
sudo apt-get update
sudo apt-get install cuda-toolkit cuda-driver nvidia-gds
sudo reboot
sudo apt-get install linux-headers-$(uname -r)
sudo reboot
```

## Compile kernel modules for wifi

### Install linux kernel sources

```
sudo apt install linux-source
tar xvf /usr/src/linux-source-6.8.0/linux-source-6.8.0.tar.bz2
```

### Install nvidia kernel's headers

sudo apt install linux-headers-6.8.0-1014-nvidia-lowlatency
cd /usr/src/linux-headers-6.8.0-1014-nvidia-lowlatency/

### Compile iwlwifi, mac80211 cfg80211 modules

```
sudo apt-get install libopenssl-dev

MDIR=/home/ubuntu/linux-source-6.8.0/drivers/net/wireless/intel/iwlwifi
KCFLAGS=-I$MDIR make M=$MDIR modules
sudo KCFLAGS=-I$MDIR make M=$MDIR modules_install

MDIR=/home/ubuntu/linux-source-6.8.0/net/mac80211
KCFLAGS=-I$MDIR make M=$MDIR modules
sudo KCFLAGS=-I$MDIR make M=$MDIR modules_install

MDIR=/home/ubuntu/linux-source-6.8.0/net/wireless
make M=$MDIR
sudo make M=$MDIR modules_install

sudo modprobe /usr/lib/modules/6.8.0-1014-nvidia-lowlatency/updates/cfg80211.ko
sudo modprobe /usr/lib/modules/6.8.0-1014-nvidia-lowlatency/updates/mac80211.ko
sudo modprobe /usr/lib/modules/6.8.0-1014-nvidia-lowlatency/updates/iwlwifi.ko
sudo modprobe /usr/lib/modules/6.8.0-1014-nvidia-lowlatency/updates/mvm/iwlmvm.ko

sudo lsmod | grep "iwlwifi\|Used\|iwlmvm\|cfg80211\|mac80211\|libarc4"

sudo netplan apply
ip addr
```

## Configure Cuda environment

```
export LD_LIBRARY_PATH=/usr/local/cuda-12.6/lib64 ${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}
export PATH=/usr/local/cuda-12.6/bin${PATH:+:${PATH}}
```

## Install docker

install [docker](https://docs.docker.com/engine/install/ubuntu/)
https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository

add user to "docker" group: `$ sudo usermod -aG docker $USER && newgrp docker`

## Install nvidia container toolkit

https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html


### Test

```shell
$ sudo docker run --rm --runtime=nvidia --gpus all ubuntu nvidia-smi
or
$ sudo docker run --gpus all nvidia/cuda:12.6.1-devel-ubi8 nvidia-smi
```
If:

Failed to initialize NVML: Unknown Error ===> [no-cgroups = false](https://stackoverflow.com/questions/72932940/failed-to-initialize-nvml-unknown-error-in-docker-after-few-hours)







### Note for later

```shell
pip3 install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124 --upgrade --force-reinstall
```