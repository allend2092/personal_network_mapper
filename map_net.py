import os
import subprocess
import scapy.all as scapy
import ipaddress
import random
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# Directory to store the results
output_dir = 'network_discovery_results'
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# Function to discover local network addresses
def discover_local_network(network_range):
    print(f"Scanning local network: {network_range}")
    arp_request = scapy.ARP(pdst=network_range)
    broadcast = scapy.Ether(dst="ff:ff:ff:ff:ff:ff")
    arp_request_broadcast = broadcast / arp_request
    answered_list = scapy.srp(arp_request_broadcast, timeout=1, verbose=False)[0]
    local_ips = [answer[1].psrc for answer in answered_list]
    return local_ips

# Function to discover reachable external addresses
def discover_external_addresses(addresses):
    print("Pinging external addresses...")
    reachable_addresses = []
    for address in addresses:
        response = subprocess.run(['ping', '-c', '1', address], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if response.returncode == 0:
            reachable_addresses.append(address)
            print(f"Address reachable: {address}")
        else:
            print(f"Address not reachable: {address}")
    return reachable_addresses

# Function to perform traceroute
def perform_traceroute(address):
    print(f"Performing traceroute to {address}...")
    result = subprocess.run(['traceroute', address], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return address, result.stdout.decode('utf-8')

# Function to generate random public IP addresses
def generate_random_public_ips(count):
    print(f"Generating {count} random public IP addresses...")
    public_ips = []
    while len(public_ips) < count:
        # Generate a random IP address
        random_ip = ipaddress.IPv4Address(random.randint(0, (1 << 32) - 1))
        # Check if the IP is public
        if random_ip.is_global:
            public_ips.append(str(random_ip))
    print(f"Generated {count} random public IP addresses.")
    return public_ips

# Main function
def main():
    local_network_range = "172.16.0.0/16"
    # Generate 100 random public IP addresses
    external_addresses = generate_random_public_ips(100)

    # Discover local network addresses
    print("Discovering local network addresses...")
    local_ips = discover_local_network(local_network_range)
    with open(os.path.join(output_dir, 'local_ips.txt'), 'w') as f:
        for ip in local_ips:
            f.write(f"{ip}\n")
    print("Local network discovery complete.")

    # Discover reachable external addresses
    print("Discovering reachable external addresses...")
    reachable_external_ips = discover_external_addresses(external_addresses)
    with open(os.path.join(output_dir, 'external_ips.txt'), 'w') as f:
        for ip in reachable_external_ips:
            f.write(f"{ip}\n")
    print("Reachable external address discovery complete.")

    # Perform traceroute and record results using multi-threading
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    traceroute_dir = os.path.join(output_dir, f"traceroute_{timestamp}")
    os.makedirs(traceroute_dir)

    print("Starting traceroute operations...")
    with ThreadPoolExecutor(max_workers=4) as executor:
        future_to_ip = {executor.submit(perform_traceroute, ip): ip for ip in reachable_external_ips}
        for future in as_completed(future_to_ip):
            ip = future_to_ip[future]
            try:
                ip, trace_result = future.result()
                with open(os.path.join(traceroute_dir, f"{ip}.txt"), 'w') as f:
                    f.write(trace_result)
                print(f"Traceroute to {ip} complete.")
            except Exception as e:
                print(f"Traceroute to {ip} generated an exception: {e}")

    print("All traceroute operations complete.")

if __name__ == "__main__":
    main()
