## hh_applicant_tool (vendored)

The `hh_applicant_tool/` package here is vendored from https://github.com/s3rgeym/hh-applicant-tool
(by s3rgeym), included with the author's direct permission for use in this project. It is driven
by `bridge.py`, a small JSON-RPC-over-stdio adapter around its existing `ui/api.py` `Api` class -
see the "💼 Jobs" tab in the main app.

### Setup

```
pip install -r requirements.txt
playwright install chromium   # only needed for hh.ru login (Api.start_login)
```

Set the Python interpreter path in the app's Settings -> "Jobs (hh.ru)" section if `python` is not
on PATH or you're using a specific virtualenv.
