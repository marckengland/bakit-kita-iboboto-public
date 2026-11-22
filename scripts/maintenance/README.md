# Regression compatibility paths

These paths remain because the existing regression suite reads them directly.
They are not a public research seed or a maintenance tool for a live database.

The four reviewed-case fixture commands use a database factory that always refuses
standalone execution. The tests substitute a database double and run the retained
seed and repair logic. The broader accuracy and backfill paths retain their
execution hold without the old data or mappings.

See the [regression fixture notes](../regression/README.md) and
[publication record](../../PUBLICATION.md#synthetic-regression-fixtures).
