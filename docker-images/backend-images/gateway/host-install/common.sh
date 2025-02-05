#!/bin/bash

get_app_port() {
  local count=$1
  echo $((50000 + count - 1))
}

get_vpn_port() {
  local count=$1
  echo $((49000 + count - 1))
}