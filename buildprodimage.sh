#!/bin/bash
tag=$1
prodcontainer="ghcr.io/${tag}:latest"
echo building $prodcontainer
docker build -t $prodcontainer .
docker push $prodcontainer
