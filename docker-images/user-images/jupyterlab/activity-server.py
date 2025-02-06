from http.server import BaseHTTPRequestHandler, HTTPServer
import subprocess
import json
import os

class SimpleHTTPRequestHandler(BaseHTTPRequestHandler):

    def do_POST(self):
        if self.path == '/activity':
            # Get the length of the data
            content_length = int(self.headers['Content-Length'])
            # Read the data
            post_data = self.rfile.read(content_length).decode('utf-8')
            # Print received JSON payload
            print(f"########## Received JSON payload: {post_data}", flush=True)

            # Extract Authorization header if it exists
            authorization_header = self.headers.get('Authorization')
            if authorization_header:
                print(f"########## Received Authorization header: {authorization_header}", flush=True)

            # Check if /tmp/gateway file exists
            gateway_file = '/tmp/gateway'
            if not os.path.exists(gateway_file):
                print(f"########## File {gateway_file} does not exist", flush=True)
                self.send_response(500)
                self.end_headers()
                return

            # Read hostname from file /tmp/gateway
            try:
                with open(gateway_file, 'r') as file:
                    hostname = file.read().strip()
                    print(f"########## Read hostname from /tmp/gateway: {hostname}", flush=True)
            except Exception as e:
                print(f"########## Failed to read hostname from /tmp/gateway: {e}", flush=True)
                self.send_response(500)
                self.end_headers()
                return
            
             # Parse the received JSON payload to extract last_activity
            try:
                data = json.loads(post_data)
                last_activity = data.get('last_activity')
                if not last_activity:
                    raise ValueError("Missing 'last_activity' in the payload")
            except Exception as e:
                print(f"########## Failed to parse JSON payload: {e}", flush=True)
                self.send_response(400)
                self.end_headers()
                return

            # Construct new JSON payload for /collab/event
            event_payload = json.dumps({
                "event": {
                    "type": "activity",
                    "last_activity": last_activity
                }
            })

            # Use curl to send an HTTP POST request with the same JSON payload and Authorization header
            # TODO: remove -k, add certificate in development
            curl_command = [
                'curl', '-k', '-X', 'POST', f'https://{hostname}/collab/event', 
                '-H', 'Content-Type: application/json', 
                '-d', event_payload
            ]
            if authorization_header:
                curl_command.extend(['-H', f'Authorization: {authorization_header}'])
            
            print(f"########## Executing curl command: {' '.join(curl_command)}", flush=True)
            subprocess.run(curl_command)
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {'status': 'Request received'}
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            # Send 404 response for all other paths
            self.send_response(404)
            self.end_headers()

def run(server_class=HTTPServer, handler_class=SimpleHTTPRequestHandler, port=8000):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f'########## Starting httpd server on port {port}...', flush=True)
    httpd.serve_forever()

if __name__ == '__main__':
    run()
