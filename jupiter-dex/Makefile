.PHONY: protogen build pack stream deploy

ENDPOINT ?= mainnet.sol.streamingfast.io:443
START_BLOCK ?= 0
STOP_BLOCK ?= +10

protogen:
	substreams protogen ./substreams.yaml --exclude-paths="sf/substreams,google"

build:
	cargo build --target wasm32-unknown-unknown --release

pack:
	substreams pack ./substreams.yaml

stream: build pack
	substreams run -e $(ENDPOINT) substreams.yaml graph_out -s $(START_BLOCK) -t $(STOP_BLOCK)

deploy:
	graph deploy --studio jupiter-dex

