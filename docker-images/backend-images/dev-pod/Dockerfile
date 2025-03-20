FROM ubuntu:24.04

RUN apt update && apt install sudo curl nfs-common inetutils-ping -y

# install node

RUN apt-get update && apt-get install -y ca-certificates curl gnupg
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_23.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
RUN apt-get update && apt-get install nodejs -y

# create user "dev"

ENV DEV_USER=dev
ENV WORKSPACE=/home/${DEV_USER}/workspace

RUN groupadd ${DEV_USER}
RUN useradd -rm -d /home/${DEV_USER} -s /bin/bash -g root -G sudo -u 1001 ${DEV_USER}
RUN usermod -aG ${DEV_USER} ${DEV_USER}
RUN echo "${DEV_USER}:${DEV_USER}" | chpasswd
RUN echo "${DEV_USER} ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

COPY ./.bashrc /root

# switch to user dev

USER ${DEV_USER}

COPY ./.bashrc ./mount-workspace.sh ./main.sh /home/dev/

WORKDIR /home/dev

CMD /home/dev/main.sh
