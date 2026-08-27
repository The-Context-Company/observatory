# tcc-otel (deprecated)

This package has been renamed to [`contextcompany`](https://pypi.org/project/contextcompany/).

```bash
pip install contextcompany
```

`tcc-otel` is no longer maintained. Installing it pulls in `contextcompany` and re-exports its API with a deprecation warning, but you should migrate your imports:

```python
# Before
import tcc_otel

# After
import contextcompany
```

- Website: https://www.thecontextcompany.com
- Documentation: https://docs.thecontextcompany.com
- Source: https://github.com/The-Context-Company/observatory
