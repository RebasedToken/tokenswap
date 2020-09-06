www:
	@python2 -m SimpleHTTPServer 8000

deploy:
	@surge -d https://rebased-token-swap.surge.sh -p .

.PHONY: \
	deploy \
	www