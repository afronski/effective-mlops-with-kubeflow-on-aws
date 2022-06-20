all: install

install:
	virtualenv .env --python=python3.8
	curl -sS https://bootstrap.pypa.io/get-pip.py | .env/bin/python
	.env/bin/python -m pip install -r requirements.txt
	npm install --global aws-cdk

clean:
	rm -rf .env/
