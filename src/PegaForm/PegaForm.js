/* eslint no-eval: 0 */
import React, { Component } from "react";
import { connect } from "react-redux";
import {
  Header,
  Checkbox,
  Form,
  Grid,
  Divider,
  Table,
  Button,
  Icon,
  Popup,
  Segment,
  Label,
  Radio
} from "semantic-ui-react";
import { SingleDatePicker } from "react-dates";
import _ from "lodash";
import moment from "moment";

import { assignmentActions, caseActions } from "../_actions";
import {
  fieldTypes,
  sourceTypes,
  layoutTypes,
  gridTypes,
  pageNames,
  actionNames,
  iconSources,
  standardIcons
} from "../_constants";
import { DataPageDropdown, PegaAutoComplete } from "../_components";
import { ReferenceHelper } from "../_helpers";
import { errorActions } from "../_actions";

// import { locale } from "core-js";

/**
 * Component to handle building forms from Pega layout APIs
 * Can be used to build an entire form, page, or single view.
 */
class PegaForm extends Component {
  /**
   * Constructor stores WorkObject
   * @param { Object } workObject - React component corresponding to the WorkObject
   */
  constructor(props) {
    super(props);

    this.supportedActions = [
      actionNames.POST_VALUE,
      actionNames.SET_VALUE,
      actionNames.REFRESH,
      actionNames.PERFORM_ACTION,
      actionNames.RUN_SCRIPT,
      actionNames.OPEN_URL
    ];

    let viewOrPage = props.view ? props.view : props.page;

    this.state = {
      datePickerFocused: {},
      values:
        this.props.openCasesData &&
        this.props.openCasesData[this.props.caseID] &&
        Object.keys(this.props.openCasesData[this.props.caseID]).length !== 0
          ? this.props.openCasesData[this.props.caseID]
          : ReferenceHelper.getInitialValuesFromView(viewOrPage),
      loadingElems: {},
      validationErrors: this.getValidationErrorsByKey(props.validationErrors)
    };
  }

  /**
   * Hooking into lifecycle methods to ensure when getting a new view, we initialize
   * the state of the values object.
   * Also using this hook to ensure validationErrors are stored correctly.
   * @param { Object } nextProps
   * @param { Object } nextState
   */
  componentWillUpdate(nextProps, nextState) {
    if (!_.isEqual(nextProps.view, this.props.view)) {
      // If we have a new view, reinitialize our values
      this.setState({
        values: ReferenceHelper.getInitialValuesFromView(nextProps.view)
      });
    } else if (nextProps.page && !this.props.page) {
      // If we are getting a new page (harness), we may need values from its fields
      this.setState({
        values: ReferenceHelper.getInitialValuesFromView(nextProps.page)
      });
    } else if (nextProps.forceRefresh && !this.props.forceRefresh) {
      // If we have performed a case-level refresh, we want to force reinitialize the values
      this.setState({
        values: ReferenceHelper.getInitialValuesFromView(nextProps.view)
      });
      this.props.resetForceRefresh();
    }

    if (
      nextProps.validationErrors &&
      !_.isEqual(this.props.validationErrors, nextProps.validationErrors)
    ) {
      this.setState({
        validationErrors: this.getValidationErrorsByKey(
          nextProps.validationErrors
        )
      });
    }
  }

  // static getDerivedStateFromProps(props, state) {
  //   console.log("From getDrivedStateFromProps");
  // }

  componentWillUnmount() {
    this.props.dispatch(
      assignmentActions.saveCaseData(this.props.caseID, this.state.values)
    );
  }

  /**
   * Top level method to be called when generating the form.
   * @return { Object } React component for the form
   */
  getForm() {
    return (
      <Form
        warning
        onSubmit={() => this.handleSubmit()}
        loading={this.props.loading}
      >
        <Segment attached="top">
          <Header as="h2" textAlign="center">
            {this.props.header}
          </Header>
        </Segment>
        <Segment attached>
          {this.props.view && this.createView(this.props.view)}
        </Segment>
        <Segment attached="bottom" style={{ overflow: "hidden" }}>
          <Button.Group floated="left">
            <Button onClick={(e, data) => this.handleCancel(e, data)}>
              Cancel
            </Button>
          </Button.Group>
          <Button.Group floated="right">
            <Button onClick={(e, data) => this.handleSave(e, data)}>
              Save
            </Button>
            <Button type="submit" primary>
              Submit
            </Button>
          </Button.Group>
        </Segment>
      </Form>
    );
  }

  /**
   * Top level method to call when generating a page. (Pega harness)
   * @return { Object } React component for the page
   */
  getPage() {
    const isNew = this.props.page.name === pageNames.NEW;
    const isConfirm = this.props.page.name === pageNames.CONFIRM;

    return (
      <Form onSubmit={isNew ? () => this.handleCaseCreate() : null}>
        <Segment attached="top">
          <Header as="h2" textAlign="center">
            {this.props.page.name}
            {isConfirm && (
              <Header.Subheader>
                Status: {this.props.caseStatus}
              </Header.Subheader>
            )}
          </Header>
        </Segment>
        <Segment attached={isNew ? true : "bottom"}>
          {this.props.page && this.createView(this.props.page)}
        </Segment>
        {isNew && (
          <Segment attached="bottom">
            <Button type="submit" primary>
              Submit
            </Button>
          </Segment>
        )}
        {isConfirm && (
          <div className="middle aligned row">
            <Grid centered>
              <Grid.Column textAlign="center">
                <Button
                  primary
                  onClick={(e, data) => this.handleCancel(e, data)}
                >
                  Close
                </Button>
              </Grid.Column>
            </Grid>
          </div>
        )}
      </Form>
    );
  }

  /**
   * Top level method to call when generating a standalone view for case. (Section)
   * @return { Object } React component for the view
   */
  getCaseView() {
    const { caseView } = this.props;

    if (!caseView) {
      return <Segment loading />;
    }

    return (
      <Form>
        <Segment attached="top">
          <Header as="h2" textAlign="center">
            {caseView.name}
          </Header>
        </Segment>
        <Segment attached="bottom">{this.createView(caseView)}</Segment>
      </Form>
    );
  }

  /**
   * Create a view.
   * @param { Object } view - view returned from the API. Can be a nested view.
   * @param { int } index - index for elem. Needed for unique component keys.
   * @return { Object } React component with all the view's children.
   */
  createView(view, index = 0) {
    if (view.visible === false) {
      return null;
    }

    return (
      <div key={index}>
        {view.groups.map((group, childIndex) => {
          return this.createGroup(group, childIndex);
        })}
      </div>
    );
  }

  /**
   * Create a group.
   * @param { Object } group - Single group returned from API.
   * @param { int } index - index for elem. Needed for unique component keys.
   * @return { Object } React component with all the group's children.
   */
  createGroup(group, index = 0, showLabel = true) {
    if (group.view) {
      // Return null is view is visible. Doing it at this level to prevent
      // the inclusion of extra <Divider /> elements.
      if (group.view.visible === false) {
        return null;
      }

      return (
        <div key={index}>
          <Divider />
          {this.createView(group.view, index)}
        </div>
      );
    }

    if (group.layout) {
      return this.createLayout(group.layout, index);
    }

    if (group.paragraph) {
      return this.createParagraph(group.paragraph, index);
    }

    if (group.caption) {
      return this.createCaption(group.caption, index);
    }

    if (group.field) {
      return this.createField(group.field, index, showLabel);
    }
  }

  /**
   * Create a layout.
   * @param { Object } layout - Single layout returned from API.
   * @param { int } index - index for elem. Needed for unique component keys.
   * @return { Object } React component with all the layout's children.
   */
  createLayout(layout, index = 0) {
    if (layout.visible === false) {
      return;
    }

    let header = layout.title ? (
      <Header as="h3" textAlign="center">
        {layout.title}
      </Header>
    ) : null;

    switch (layout.groupFormat) {
      case layoutTypes.INLINE_GRID_DOUBLE:
        return (
          <div className={this.getLayoutStyle(layout)} key={index}>
            {header}
            <Grid columns={2} divided>
              <Grid.Row>
                {layout.groups.map((group, childIndex) => {
                  return (
                    <Grid.Column width={8} key={childIndex}>
                      {this.createGroup(group)}
                    </Grid.Column>
                  );
                })}
              </Grid.Row>
            </Grid>
          </div>
        );
      case layoutTypes.INLINE_GRID_TRIPLE:
        return (
          <div className={this.getLayoutStyle(layout)} key={index}>
            {header}
            <Grid columns={3} divided>
              <Grid.Row>
                {layout.groups.map((group, childIndex) => {
                  return (
                    <Grid.Column key={childIndex}>
                      {this.createGroup(group)}
                    </Grid.Column>
                  );
                })}
              </Grid.Row>
            </Grid>
          </div>
        );
      case layoutTypes.INLINE_GRID_70_30:
      case layoutTypes.INLINE_GRID_30_70:
        let colWidths =
          layout.groupFormat === layoutTypes.INLINE_GRID_70_30
            ? [11, 5]
            : [5, 11];

        return (
          <div className={this.getLayoutStyle(layout)} key={index}>
            {header}
            <Grid columns={2} divided>
              <Grid.Row>
                {layout.groups.map((group, childIndex) => {
                  return (
                    <Grid.Column width={colWidths[childIndex]} key={childIndex}>
                      {this.createGroup(group)}
                    </Grid.Column>
                  );
                })}
              </Grid.Row>
            </Grid>
          </div>
        );
      case layoutTypes.STACKED:
        return (
          <div className={this.getLayoutStyle(layout)} key={index}>
            {header}
            {layout.groups.map((group, childIndex) => {
              return this.createGroup(group, childIndex);
            })}
          </div>
        );
      case layoutTypes.GRID:
        return (
          <div className={this.getLayoutStyle(layout)} key={index}>
            {header}
            {this.createGrid(layout, index)}
          </div>
        );
      case layoutTypes.DYNAMIC:
        return (
          <div className={this.getLayoutStyle(layout)} key={index}>
            {header}
            {layout.rows.map((row, childIndex) => {
              return row.groups.map((group, childIndexB) => {
                return this.createGroup(group, childIndexB);
              });
            })}
          </div>
        );
      case layoutTypes.INLINE_MIDDLE:
        return (
          <div className={this.getLayoutStyle(layout)} key={index}>
            {header}
            <Grid>
              {layout.groups.map((group, childIndex) => {
                return (
                  <Grid.Column key={childIndex}>
                    {this.createGroup(group)}
                  </Grid.Column>
                );
              })}
            </Grid>
          </div>
        );
      default:
        if (layout.groups) {
          return (
            <div className={this.getLayoutStyle(layout)} key={index}>
              {header}
              {layout.groups.map((group, childIndex) => {
                return this.createGroup(group, childIndex);
              })}
            </div>
          );
        }

        if (layout.view) {
          return (
            <div className={this.getLayoutStyle(layout)} key={index}>
              {header}
              {this.createView(layout.view)}
            </div>
          );
        }
        break;
    }
  }

  /**
   * Get layout style
   * @param { layout } layout - Single layout returned from API, that contains a grid.
   */

  getLayoutStyle(layout) {
    let layoutStyle = "";
    if (layout && layout.containerFormat) {
      if (layout.containerFormat.toUpperCase() === "WARNINGS") {
        layoutStyle = "layout-warning";
      } else if (layout.containerFormat.toUpperCase() === "ERROR") {
        layoutStyle = "layout-error";
      }
    }
    return layoutStyle;
  }

  /**
   * Create a grid. For PageGroups and PageLists.
   * @param { Object } layout - Single layout returned from API, that contains a grid.
   * @param { int } index - index for elem. Needed for unique component keys.
   * @return { Object } React component with all the grid's children.
   */
  createGrid(layout, index = 0) {
    const reference = layout.reference;

    const actionHandler =
      layout.referenceType === gridTypes.GROUP
        ? (e, data) => this.handleGroupActions(e, data)
        : (e, data) => this.handleListActions(e, data);

    const footerWidth =
      layout.referenceType === gridTypes.GROUP
        ? layout.header.groups.length + 1
        : layout.header.groups.length;

    return (
      <Table compact celled key={index}>
        <Table.Header>
          <Table.Row>
            {layout.header.groups.map((group, childIndex) => {
              return (
                <Table.HeaderCell key={childIndex}>
                  {this.createGroup(group, childIndex)}
                </Table.HeaderCell>
              );
            })}
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {layout.rows.map((row, childIndex) => {
            return (
              <Table.Row key={childIndex}>
                {row.groups.map((group, childIndexB) => {
                  return (
                    <Table.Cell key={childIndexB}>
                      {this.createGroup(group, childIndexB, false)}
                    </Table.Cell>
                  );
                })}
              </Table.Row>
            );
          })}
        </Table.Body>
        <Table.Footer fullWidth>
          <Table.Row>
            <Table.HeaderCell colSpan={footerWidth}>
              <Button
                icon
                labelPosition="left"
                primary
                size="small"
                onClick={actionHandler}
                action={"add"}
                reference={reference}
                referencetype={layout.referenceType}
                loading={this.state.loadingElems[reference]}
              >
                <Icon name="plus" /> Add Row
              </Button>
              <Button
                icon
                labelPosition="left"
                negative
                size="small"
                onClick={actionHandler}
                action={"remove"}
                reference={reference}
                referencetype={layout.referenceType}
                loading={this.state.loadingElems[reference]}
              >
                <Icon name="minus" /> Delete Row
              </Button>
            </Table.HeaderCell>
          </Table.Row>
        </Table.Footer>
      </Table>
    );
  }

  /**
   * Create a paragraph
   * @param { Object } paragraph - Paragraph returned from API
   * @param { int } index - index for elem. Needed for unique component keys.
   * @return { Object } React component corresponding to the paragraph.
   */
  createParagraph(paragraph, index) {
    if (!paragraph.visible) {
      return null;
    }

    return (
      <div key={index} dangerouslySetInnerHTML={{ __html: paragraph.value }} />
    );
  }

  /**
   * Create a caption
   * @param { Object } caption - caption returned from API
   * @param { int } index - index for elem. Needed for unique component keys.
   * @return { Object } React component corresponding to the paragraph.
   */
  createCaption(caption, index) {
    return this.getReadOnlyText(caption.value, "", index);
  }

  /**
   * Create a field.
   * @param { Object } field - Single field returned from API.
   * @param { int } index - index for elem. Needed for unique component keys.
   * @return { Object } React component correpsonding to the field.
   */
  createField(field, index, showLabel) {
    if (field.visible === false) {
      return;
    }

    let fieldElem;

    let value = this.state.values[field.reference];
    if (value === undefined || value === null) {
      value = field.value;
      if (!value) value = "";
    }

    const handleChange = (e, data, callback) =>
      this.handleChange(e, data, callback);

    let handleEvent = this.generateEventHandler(field);

    const required = field.required ? true : false;
    const readOnly = field.readOnly ? true : false;
    const disabled = field.disabled ? true : false;
    let label = null;

    if (showLabel) {
      if (!field.label && field.labelReserveSpace) {
        label = " ";
      } else if (field.label) {
        label = field.label;
      }
    }

    let error = false;
    let errorMessage;

    if (this.state.validationErrors[field.reference]) {
      error = true;
      errorMessage = this.state.validationErrors[field.reference];
    } else if (field.validationMessages && value === field.value) {
      error = true;
      errorMessage = field.validationMessages;
    }

    switch (field.control.type) {
      case fieldTypes.CHECKBOX:
        value = field.value === "true" || value === true;
        if (readOnly) {
          let displayValue = field.value ? "yes" : "no";
          fieldElem = this.getReadOnlyText(label, displayValue, index);
        } else if (field.control.modes[0].captionPosition === "left") {
          fieldElem = (
            <div key={index} style={{ padding: "5px" }}>
              <div
                className={"ui large basic label"}
                style={{
                  border: 0,
                  paddingLeft: 0,
                  fontWeight: 700,
                  display: "block"
                }}
              >
                {field.showLabel && field.label}
              </div>
              <Form.Field required={required} disabled={disabled} error={error}>
                <div className="ui inline fields">
                  <label style={{ fontWeight: 500 }} className="ui checkbox">
                    {field.control.label}
                  </label>
                  <Checkbox
                    name={field.name}
                    defaultChecked={value}
                    onChange={(e, data) => {
                      handleChange(e, data, handleEvent);
                    }}
                    reference={field.reference}
                    {...this.getTooltip(field)}
                  />
                </div>
              </Form.Field>
            </div>
          );
        } else {
          fieldElem = (
            <div key={index} style={{ padding: "5px" }}>
              <div
                className={"ui large basic label"}
                style={{
                  border: 0,
                  paddingLeft: 0,
                  fontWeight: 700
                }}
              >
                {field.showLabel && field.label}
              </div>
              <Form.Field required={required} disabled={disabled} error={error}>
                <Checkbox
                  label={field.control.label}
                  name={field.name}
                  defaultChecked={value}
                  onChange={(e, data) => {
                    handleChange(e, data, handleEvent);
                  }}
                  reference={field.reference}
                  {...this.getTooltip(field)}
                />
              </Form.Field>
            </div>
          );
        }
        break;
      case fieldTypes.RADIOBUTTONS:
        if (readOnly) {
          fieldElem = this.getReadOnlyText(label, field.value, index);
        } else {
          fieldElem = (
            <div key={index} style={{ padding: "5px" }}>
              <div
                className={"ui large basic label"}
                style={{
                  border: 0,
                  paddingLeft: 0,
                  fontWeight: 700
                }}
                {...this.getTooltip(field)}
              >
                {field.label}
              </div>
              {field.control.modes[0].options.map(option => {
                let checked = option.key === value;
                return (
                  <Form.Field
                    key={option.key}
                    disabled={disabled || readOnly}
                    control={Radio}
                    label={option.value}
                    value={option.key}
                    reference={field.reference}
                    onChange={(e, data, callback) =>
                      this.handleChange(e, data, callback)
                    }
                    checked={checked}
                  />
                );
              })}
            </div>
          );
        }
        break;
      case fieldTypes.AUTOCOMPLETE:
        if (readOnly) {
          fieldElem = this.getReadOnlyText(label, field.value, index);
        } else {
          let mode = field.control.modes[0];
          fieldElem = (
            <PegaAutoComplete
              key={index}
              mode={mode}
              pageName={mode.dataPageID}
              pageParams={{}}
              caseDetail={this.props.caseDetail}
              propertyName={mode.dataPageValue}
              propertyPrompt={mode.dataPagePrompt}
              reference={field.reference}
              onChange={handleChange}
              onResultSelect={handleEvent}
              value={value}
              required={required}
              disabled={disabled || readOnly}
              error={error}
              label={label}
              tooltip={this.getTooltip(field)}
            />
          );
        }
        break;
      case fieldTypes.DROPDOWN:
        if (readOnly) {
          fieldElem = this.getReadOnlyText(label, field.value, index);
        } else {
          let control = field.control;
          let mode = control.modes[0];
          let placeholder = mode.placeholder
            ? this.getPropertyValue(mode.placeholder)
            : label;
          if (mode && mode.listSource === sourceTypes.DATAPAGE) {
            fieldElem = (
              <DataPageDropdown
                key={index}
                placeholder={placeholder}
                labeled
                fluid
                selection
                pageName={mode.dataPageID}
                pageParams={{}}
                propertyName={mode.dataPageValue}
                propertyPrompt={mode.dataPagePrompt}
                reference={field.reference}
                onChange={handleChange}
                onBlur={handleEvent}
                value={value}
                required={required}
                disabled={disabled}
                error={error}
                label={label}
                tooltip={this.getTooltip(field)}
              />
            );
          } else {
            let options = this.getDropdownOptions(field);
            fieldElem = (
              <div key={index} style={{ marginBottom: 14 }}>
                <Form.Dropdown
                  required={required}
                  disabled={disabled}
                  error={error}
                  label={label}
                  name={field.name}
                  placeholder={placeholder}
                  labeled
                  fluid
                  selection
                  options={options}
                  onChange={handleChange}
                  onBlur={handleEvent}
                  reference={field.reference}
                  value={value}
                  {...this.getTooltip(field)}
                />
              </div>
            );
          }
        }
        break;
      case fieldTypes.EMAIL:
      case fieldTypes.PHONE:
      case fieldTypes.INTEGER:
      case fieldTypes.URL:
      case fieldTypes.CURRENCY:
      case fieldTypes.TEXTINPUT:
        if (readOnly) {
          fieldElem = this.getReadOnlyText(label, field.value, index, field);
        } else {
          // let isNum =
          //   field.control.type === fieldTypes.INTEGER ||
          //   field.control.type === fieldTypes.CURRENCY;
          let type = this.getFormatType(field);
          let pattern =
            type === "tel" ? { pattern: "[0-9]{3}-[0-9]{3}-[0-9]{4}" } : {};
          value = this.sanitizeHTML(value);
          fieldElem = (
            <Form.Input
              key={index}
              required={required}
              disabled={disabled}
              name={field.name}
              type={type}
              fluid
              {...pattern}
              label={label}
              placeholder={type === "tel" ? "123-456-7890" : label}
              onChange={handleChange}
              onBlur={handleEvent}
              value={value}
              reference={field.reference}
              error={error}
              {...this.getTooltip(field)}
            />
          );
        }
        break;
      case fieldTypes.TEXTAREA:
        if (readOnly) {
          fieldElem = this.getReadOnlyText(label, field.value, index);
        } else {
          fieldElem = (
            <div key={index} {...this.getTooltip(field)}>
              <Form.TextArea
                required={required}
                disabled={disabled}
                name={field.name}
                label={label}
                placeholder={label}
                onChange={handleChange}
                onBlur={handleEvent}
                value={value}
                reference={field.reference}
                error={error}
              />
            </div>
          );
        }
        break;
      case fieldTypes.DISPLAYTEXT:
        let displayTextVal = field.value;
        if (field.type === "Date Time") {
          // displayTextVal.replace("GMT", "+0000"),
          displayTextVal = moment(
            displayTextVal.replace("GMT", "Z"),
            "YYYYMMDD[T]HHmmss[.]SSS Z"
          ).fromNow();
        } else {
          displayTextVal = this.getDisplayTextFormattedValue(field);
        }
        fieldElem = this.getReadOnlyText(label, displayTextVal, index, field);
        break;
      case fieldTypes.DATETIME:
        if (readOnly) {
          const displayDate = this.getDisplayTextFormattedValue(field);
          fieldElem = this.getReadOnlyText(label, displayDate, index, field);
        } else {
          let date = value ? moment(value) : moment();
          if (date && !date.isValid()) {
            date = moment();
          }

          fieldElem = (
            <Form.Field
              id={field.testID}
              key={index}
              required={required}
              disabled={disabled}
              error={error}
              {...this.getTooltip(field)}
            >
              <Header as="h4">{label}</Header>
              <SingleDatePicker
                date={date}
                onDateChange={date =>
                  this.handleChange(
                    date,
                    {
                      name: field.name,
                      reference: field.reference
                    },
                    null,
                    field
                  )
                }
                focused={this.state.datePickerFocused[field.fieldID]}
                onFocusChange={({ focused }) =>
                  this.focusDatePicker(focused, field)
                }
                isOutsideRange={() => false}
              />
            </Form.Field>
          );
        }
        break;
      case fieldTypes.BUTTON:
        let buttonFormat = this.getButtonFormat(field);
        fieldElem = (
          <Form.Button
            key={index}
            content={field.control.label}
            name={field.name}
            required={required}
            disabled={readOnly || disabled}
            onClick={handleEvent}
            label={field.showLabel ? label : null}
            {...this.getTooltip(field)}
            {...buttonFormat}
          />
        );
        break;
      case fieldTypes.LABEL:
        fieldElem = (
          <Label key={index} size="large">
            {label}
          </Label>
        );
        break;
      case fieldTypes.LINK:
        const linkMode = field.control.modes[0] ? field.control.modes[0] : {};
        const href = this.getPropertyValue(linkMode.linkData);
        let linkImage = null;
        let linkStyle = this.getLinkFormat(field);
        linkStyle["paddingLeft"] = 0;

        if (linkMode.linkImage) {
          linkImage = require(`../assets/img/${linkMode.linkImage}`);
        }
        let linkIcon = field.control.modes[1].linkStyle;
        if (linkIcon) {
          linkIcon = linkIcon.replace(/.* /, "");
          linkIcon = standardIcons[linkIcon];
        }

        fieldElem = (
          <div key={index} style={{ padding: "5px" }}>
            {field.showLabel && (
              <label
                style={{
                  display: "block",
                  fontWeight: 700
                }}
              >
                {label}
              </label>
            )}
            <Label
              as="a"
              style={linkStyle}
              href={href}
              basic
              target="_blank"
              size="large"
              {...this.getTooltip(field)}
              onClick={!href || href === "" ? handleEvent : null}
            >
              {linkIcon &&
                linkMode.linkImagePosition === "left" && (
                  <Icon name={linkIcon} />
                )}
              {linkImage &&
                linkMode.linkImagePosition === "left" && (
                  <img src={linkImage} alt="Link img left" />
                )}
              {this.getPropertyValue(field.control.label)} &nbsp;
              {linkIcon &&
                linkMode.linkImagePosition === "right" && (
                  <Icon name={linkIcon} />
                )}
              {linkImage &&
                linkMode.linkImagePosition === "right" && (
                  <img src={linkImage} alt="Link img right" />
                )}
            </Label>
          </div>
        );
        break;
      case fieldTypes.ICON:
        const iconMode = field.control.modes[0] ? field.control.modes[0] : {};
        let icon = null;
        switch (iconMode.iconSource) {
          case iconSources.STANDARD:
            icon = (
              <Icon
                name={standardIcons[iconMode.iconStandard]}
                onClick={handleEvent}
              />
            );
            break;
          case iconSources.IMAGE:
            icon = (
              <img
                src={require(`../assets/img/${iconMode.iconImage}`)}
                alt="Icon from file"
                onClick={handleEvent}
              />
            );
            break;
          case iconSources.EXTERNAL_URL:
            icon = (
              <img
                src={iconMode.iconUrl}
                alt="Icon from external URL"
                onClick={handleEvent}
              />
            );
            break;
          case iconSources.PROPERTY:
            icon = (
              <img
                src={this.getPropertyValue(iconMode.iconProperty)}
                alt="Icon from property"
                onClick={handleEvent}
              />
            );
            break;
          case iconSources.STYLECLASS:
            let iconStyle = iconMode.iconStyle;

            // we will translate "pi pi-" styles
            if (iconStyle.indexOf("pi") >= 0) {
              iconStyle = iconStyle.replace(/pi pi-/gi, "");
              iconStyle = iconStyle.replace(/-/gi, "_");
            }

            icon = (
              <div className={"ui large basic label"} style={{ border: 0 }}>
                <i
                  className={`${iconStyle} icon`}
                  alt="Icon from styleclass"
                  onClick={handleEvent}
                />
              </div>
            );
            break;
          default:
            icon = (
              <img alt="Icon with undefined source" onClick={handleEvent} />
            );
            break;
        }

        fieldElem = (
          <div key={index} {...this.getTooltip(field)}>
            {field.showLabel && (
              <label
                style={{
                  display: "block",
                  fontWeight: 700
                }}
              >
                {label}
              </label>
            )}
            {icon}
          </div>
        );
        break;
      case fieldTypes.HIDDEN:
        return;
      case fieldTypes.PXSUBSCRIPT:
        fieldElem = this.getReadOnlyText(label, field.value, index);

        break;
      default:
        fieldElem = (
          <Header key={index} as="h4">
            FormElement for '{field.control.type}' is undefined.
          </Header>
        );
        break;
    }

    if (error) {
      if (readOnly) {
        fieldElem = <div>{fieldElem}</div>;
      }

      return (
        <Popup
          key={index}
          trigger={fieldElem}
          content={errorMessage}
          size={"small"}
          position="bottom left"
        />
      );
    } else {
      return fieldElem;
    }
  }

  /**
   * Get input field type
   * @param { field } field
   */

  getFormatType(field) {
    let type;
    if (
      !field ||
      !field.control ||
      !field.control.modes ||
      field.control.modes.length === 0
    ) {
      return "text";
    }
    let fieldType = field.control.type;
    let formatType = field.control.modes[0].formatType;
    if (fieldType === fieldTypes.EMAIL || formatType === "email") {
      type = "email";
    } else if (fieldType === fieldTypes.PHONE || formatType === "tel") {
      type = "tel";
    } else if (fieldType === fieldTypes.URL || formatType === "url") {
      type = "url";
    } else if (
      fieldType === fieldTypes.INTEGER ||
      fieldType === fieldTypes.CURRENCY ||
      formatType === "number"
    ) {
      type = "number";
    } else if (!type) {
      type = "text";
    }
    return type;
  }

  /**
   * Get read only text given value.
   * Re-usable for ReadOnly elem values, and also for DisplayTexts.
   * @param { String } label
   * @param { String } value
   * @param { int } index - used for key on component, needed for unique React children
   */
  getReadOnlyText(label, value, index, field) {
    let displayValue;
    if (field && field.control.modes && field.control.modes.length > 1) {
      switch (field.control.modes[1].formatType) {
        case "email":
          displayValue = <a href={"mailto:" + value}>{value}</a>;
          break;
        case "tel":
          displayValue = <a href={"tel:" + value}>{value}</a>;
          break;
        case "url":
          displayValue = (
            <a
              target={"_blank"}
              href={value.startsWith("http") ? value : "http://" + value}
            >
              {value}
            </a>
          );
          break;
        default:
          value = this.getDisplayTextFormattedValue(field);
          break;
      }
    }

    if (!displayValue) {
      displayValue = <p>{value ? value : " "}</p>;
    }

    return (
      <div key={index} style={{ padding: "5px", whiteSpace: "pre-wrap" }}>
        <label style={{ display: "block", fontWeight: 700 }}>{label}</label>
        {displayValue}
      </div>
    );
  }

  getDisplayTextFormattedValue(field) {
    let returnValue = field.value;
    if (field && field.control.modes.length > 0 && field.value) {
      let mode = field.control.modes[1];
      if (!mode) {
        return returnValue;
      }
      if (
        (mode.dateFormat && mode.dateFormat.match(/Date-/)) ||
        (mode.dateTimeFormat && mode.dateTimeFormat.match(/DateTime-/))
      ) {
        if (returnValue.includes("GMT")) {
          // field.value = field.value.replace("GMT", "+0000");
          field.value = field.value.replace("GMT", "Z");
        }
        returnValue = this.generateDate(
          field.value,
          mode.dateTimeFormat ? mode.dateTimeFormat : mode.dateFormat
        );
      } else if (mode.formatType === "number") {
        let decimalPlaces = mode.decimalPlaces;
        if (!decimalPlaces) decimalPlaces = 2;
        let options = {
          minimumFractionDigits: decimalPlaces
        };
        if (mode.numberSymbol === "currency")
          options = {
            ...options,
            ...this.getCurrencyFormatOptions(mode)
          };
        returnValue = Number(returnValue).toLocaleString(undefined, options);
      } else if (
        mode.formatType === "text" &&
        (mode.autoAppend || mode.autoPrepend)
      ) {
        returnValue = mode.autoPrepend
          ? mode.autoPrepend + returnValue
          : returnValue;
        returnValue = mode.autoAppend
          ? returnValue + mode.autoAppend
          : returnValue;
      } else if (mode.formatType === "truefalse") {
        if (returnValue === "false") returnValue = mode.falseLabel;
        else returnValue = mode.trueLabel;
      } else if (mode.formatType === "email") {
      } else if (mode.formatType === "tel") {
        returnValue = this.generatePhoneNumber(field.value);
      } else if (mode.formatType === "url") {
        console.log("");
      } else if (mode.formatType === "advancedtext") {
      } else {
      }
    }
    returnValue = this.sanitizeHTML(returnValue);
    return returnValue;
  }

  getCurrencyFormatOptions(mode) {
    // ignoring most of the settings, but you get the idea
    let locale = navigator.language;
    let sCurrency = "USD";
    switch (locale) {
      case "en-US":
      case "es-US":
        sCurrency = "USD";
        break;
      case "en-CA":
      case "fr-CA":
        sCurrency = "CAD";
        break;
      case "fr-FR":
      case "es-ES":
      case "de-DE":
        sCurrency = "EUR";
        break;
      case "en-GB":
        sCurrency = "GBP";
        break;
      default:
        break;
    }

    let sDisplay = mode.currencySymbol;
    switch (sDisplay) {
      case "currencySymbol":
        sDisplay = "symbol";
        break;
      case "currencyCode":
        sDisplay = "code";
        break;
      case "currencyName":
        sDisplay = "name";
        break;
      default:
        break;
    }

    let props = {
      style: "currency",
      currency: sCurrency,
      currencyDisplay: sDisplay
    };

    return props;
  }

  generatePhoneNumber(sNum) {
    let locale = navigator.language;
    switch (locale) {
      case "en-US":
      case "es-US":
      case "en-CA":
      case "es-MX":
        let formattedNum = "";
        let phoneLen = sNum.length;
        if (phoneLen === 11) {
          formattedNum = sNum.substring(0, 1) + "-";
          sNum = sNum.substring(1);
        }
        if (sNum.length === 10) {
          formattedNum +=
            sNum.substring(0, 3) +
            "-" +
            sNum.substring(3, 6) +
            "-" +
            sNum.substring(6);
          sNum = formattedNum;
        }
        break;
      default:
        break;
    }

    return sNum;
  }

  generateDate(dateVal, dateFormat) {
    let sReturnDate = dateVal;
    switch (dateFormat) {
      case "Date-Short":
        // 1/1/01
        sReturnDate = moment(dateVal).format("M/D/YY");
        break;
      case "Date-Short-YYYY":
        // 1/1/2001
        sReturnDate = moment(dateVal).format("M/D/YYYY");
        break;
      case "Date-Short-Custom":
        // 01/01/01
        sReturnDate = moment(dateVal).format("MM/DD/YY");
        break;
      case "Date-Short-Custom-YYYY":
        // 01/01/2001
        sReturnDate = moment(dateVal).format("L");
        break;
      case "Date-Medium":
        // Jan 1, 2001
        sReturnDate = moment(dateVal).format("ll");
        break;
      case "Date-DayMonthYear-Custom":
        // 01-Jan-2001
        sReturnDate = moment(dateVal).format("DD-MMM-YYYY");
        break;
      case "Date-Full":
        // Monday, January 1, 2001
        sReturnDate = moment(dateVal).format("dddd, MMMM D, YYYY");
        break;
      case "Date-Long":
        // January 1, 2001
        sReturnDate = moment(dateVal).format("MMMM D, YYYY");
        break;
      case "Date-ISO-8601":
        // 2001/01/01 y/m/d
        sReturnDate = moment(dateVal).format("YYYY/MM/DD");
        break;
      case "Date-Gregorian-1":
        // 01 January, 2001
        sReturnDate = moment(dateVal).format("DD MMMM, YYYY");
        break;
      case "Date-Gregorian-2":
        // January 01, 2001
        sReturnDate = moment(dateVal).format("MMMM DD, YYYY");
        break;
      case "Date-Gregorian-3":
        // 2001, January 01
        sReturnDate = moment(dateVal).format("YYYY, MMMM DD");
        break;
      case "DateTime-Short":
        // 1/1/01 1:00 AM
        //sReturnDate = moment(dateTimeVal, moment.ISO_8601, true).format("M/D/YY h:mm a");
        sReturnDate = moment(dateVal, "YYYYMMDD[T]HHmmss[.]SSS Z").format(
          "M/D/YY h:mm A"
        );
        break;
      case "DateTime-Short-Custom":
        // 01/01/01 01:00 AM
        sReturnDate = moment(dateVal, "YYYYMMDD[T]HHmmss[.]SSS Z").format(
          "MM/DD/YY hh:mm A"
        );
        break;
      case "DateTime-Short-YYYY-Custom":
        // 01/01/2001 01:00 AM
        sReturnDate = moment(dateVal, "YYYYMMDD[T]HHmmss[.]SSS Z").format(
          "M/D/YYYY hh:mm A"
        );
        break;
      case "DateTime-Short-YYYY":
        // 1/1/2001 1:00 AM
        sReturnDate = moment(dateVal, "YYYYMMDD[T]HHmmss[.]SSS Z").format(
          "M/D/YYYY h:mm A"
        );
        break;
      case "DateTime-Medium":
        // Jan 1, 2001 1:00:00 AM
        sReturnDate = moment(dateVal, "YYYYMMDD[T]HHmmss[.]SSS Z").format(
          "MMM D, YYYY h:mm:ss A"
        );
        break;
      case "DateTime-Long":
        // January 1, 2001 1:00:00 AM
        sReturnDate = moment(dateVal, "YYYYMMDD[T]HHmmss[.]SSS Z").format(
          "MMMM D, YYYY h:mm:ss A"
        );
        break;
      case "DateTime-DayMonthYear-Custom":
        // 01-Jan-2001 1:00:00 AM
        sReturnDate = moment(dateVal, "YYYYMMDD[T]HHmmss[.]SSS Z").format(
          "DD-MMM-YYYY h:mm:ss A"
        );
        break;
      case "DateTime-Full":
        // Monday, January 1, 2001 1:00 AM EDT
        sReturnDate = moment(dateVal, "YYYYMMDD[T]HHmmss[.]SSS Z").format(
          "dddd, MMMM D, YYYY h:mm A Z"
        );
        break;
      case "DateTime-Frame":
      case "DateTime-Frame-Short":
        // 2 days, 5 hours ago
        sReturnDate = moment(dateVal, "YYYYMMDD[T]HHmmss[.]SSS Z").fromNow();
        break;
      case "DateTime-ISO-8601":
        // 2001/01/01 1:00:00 AM     y/m/d
        sReturnDate = moment(dateVal, "YYYYMMDD[T]HHmmss[.]SSS Z").format(
          "YYYY/MM/DD h:mm:ss a"
        );
        break;
      case "DateTime-Gregorian-1":
        // 01 January, 2001 1:00:00 AM
        sReturnDate = moment(dateVal, "YYYYMMDD[T]HHmmss[.]SSS Z").format(
          "DD MMMM, YYYY h:mm:ss a"
        );
        break;
      case "DateTime-Gregorian-2":
        // January 01, 2001 1:00:00 AM
        sReturnDate = moment(dateVal, "YYYYMMDD[T]HHmmss[.]SSS Z").format(
          "MMMM DD, YYYY h:mm:ss a"
        );
        break;
      case "DateTime-Gregorian-3":
        // 2001, January 01 1:00:00 AM
        sReturnDate = moment(dateVal, "YYYYMMDD[T]HHmmss[.]SSS Z").format(
          "YYYY, MMMM DD h:mm:ss a"
        );
        break;
      case "DateTime-Custom":
        break;
      default:
        break;
    }

    return sReturnDate;
  }

  /**
   * Get control format for a button
   * @param { field }
   */
  getButtonFormat(field) {
    let buttonFormat = {};
    if (
      field &&
      field.control &&
      field.control.modes &&
      field.control.modes.length > 1
    ) {
      let format = field.control.modes[1].controlFormat;
      if (format) {
        format = format.toUpperCase();
        if (format !== "STANDARD" && format !== "PZHC") {
          if (format === "STRONG") buttonFormat.primary = true;
          else if (format === "LIGHT") {
            buttonFormat.basic = true;
          } else if (format === "RED") buttonFormat.color = "red";
        }
      }
    }
    return buttonFormat;
  }

  /**
   * Get control format for a link
   * @param { field }
   */

  getLinkFormat(field) {
    let linkFormat = { border: 0 };
    if (
      field &&
      field.control &&
      field.control.modes &&
      field.control.modes.length > 1
    ) {
      let format = field.control.modes[1].controlFormat;
      if (format) {
        format = format.toUpperCase();
        if (format === "STRONG") linkFormat.fontWeight = "bolder";
        else if (format === "LIGHT") {
          linkFormat.fontWeight = "lighter";
          linkFormat.color = "lightgray";
        } else if (format === "STANDARD" && format === "PZHC")
          linkFormat.fontWeight = "normal";
        else if (format === "RED") linkFormat.color = "red";
        // else if (format === 'LIST LINK') linkFormat.color = 'red';
      }
    }
    return linkFormat;
  }

  /**
   * Get tooltip for a field
   * @param { field }
   */

  getTooltip(field) {
    let tooltip = {};
    if (
      field &&
      field.control &&
      field.control.modes &&
      field.control.modes.length > 1
    ) {
      if (
        field.control.type === fieldTypes.BUTTON ||
        field.control.type === fieldTypes.LINK ||
        field.control.type === fieldTypes.ICON
      ) {
        if (field.control.modes[1].tooltip) {
          tooltip["data-tooltip"] = field.control.modes[1].tooltip;
        }
      } else {
        if (field.control.modes[0].tooltip) {
          tooltip["data-tooltip"] = field.control.modes[0].tooltip;
        }
      }
    }
    return tooltip;
  }

  /**
   * Get dropdown options ffrom a clipboard page
   * @param { field }
   */

  getDropdownOptions(field) {
    let options = [];
    if (!field) return options;
    let control = field.control;
    let mode = control.modes[0];

    if (mode && mode.listSource === sourceTypes.PAGELIST) {
      let pageId = field.control.modes[0].clipboardPageID;
      let clipboardPagePrompt = field.control.modes[0].clipboardPagePrompt;
      let clipboardPageValue = field.control.modes[0].clipboardPageValue;
      if (pageId && clipboardPagePrompt && clipboardPageValue) {
        let optionsPage = this.props.caseDetail.content[pageId];
        if (optionsPage && optionsPage.length > 0) {
          options = optionsPage.map(item => {
            return {
              key: item[clipboardPageValue],
              text: item[clipboardPagePrompt],
              value: item[clipboardPagePrompt]
            };
          });
        }
      }
    } else {
      options = mode.options.map(option => {
        return {
          key: option.key,
          text: option.value,
          value: option.value
        };
      });
    }
    return options;
  }

  createEventHandler(actionHandlers) {
    let eventHandler = (e, data) => {
      e.preventDefault();
      actionHandlers.reduce((promise, item) => {
        return promise.then(d =>
          item.handler.call(this, e, data, item.data, item.refreshFor)
        );
      }, Promise.resolve());
    };
    return eventHandler;
  }

  /**
   * Helper function to generate an event handler function.
   * This is to support multiple actions attached to the same element;.
   * Returns a function to be called on field blur / click / etc.
   * DOES NOT UPDATE STATE.
   * @param { Object } field - field object from the API
   * @return { func } function to handle events
   */
  generateEventHandler(field) {
    let actionData = this.getActionData(field, this.supportedActions);
    // let eventHandler = (e, data) => {
    //   e.preventDefault();
    // };

    // Mark if we have already included a refresh, so we don't do duplicates
    let hasFieldRefresh = false;

    // Mark if we have both a refresh and a setValue
    // setValue using setState won't update date before the POST if we do not handle it separately
    let dataForSetValueAndRefresh = this.getDataForSetValueAndRefresh(
      actionData
    );

    let actionsList = [];

    // We are going to append together each function, startin with the base handler that does a preventDefault().
    for (let i = 0; i < actionData.length; i++) {
      switch (actionData[i].action) {
        case actionNames.SET_VALUE:
          if (!dataForSetValueAndRefresh) {
            // eventHandler = this.appendActionHandler(
            //   eventHandler,
            //   this.handleSetValue,
            //   actionData[i].actionProcess
            // );

            actionsList.push({
              handler: this.handleSetValue,
              data: actionData[i].actionProcess
            });
          }
          break;
        case actionNames.POST_VALUE:
          if (!hasFieldRefresh) {
            // eventHandler = this.appendActionHandler(
            //   eventHandler,
            //   this.handleFieldRefresh
            // );
            actionsList.push({ handler: this.handleFieldRefresh });
            hasFieldRefresh = true;
          }
          break;
        case actionNames.REFRESH:
          if (!hasFieldRefresh) {
            // eventHandler = this.appendActionHandler(
            //   eventHandler,
            //   this.handleFieldRefresh,
            //   dataForSetValueAndRefresh
            // );
            actionsList.push({
              handler: this.handleFieldRefresh,
              data: dataForSetValueAndRefresh,
              refreshFor: actionData[i]
            });
            hasFieldRefresh = true;
          }
          break;
        case actionNames.PERFORM_ACTION:
          // eventHandler = this.appendActionHandler(
          //   eventHandler,
          //   this.handlePerformAction,
          //   actionData[i].actionProcess
          // );
          actionsList.push({
            handler: this.handlePerformAction,
            data: actionData[i].actionProcess
          });
          break;
        case actionNames.RUN_SCRIPT:
          // eventHandler = this.appendActionHandler(
          //   eventHandler,
          //   this.handleRunScript,
          //   actionData[i].actionProcess
          // );
          actionsList.push({
            handler: this.handleRunScript,
            data: actionData[i].actionProcess
          });
          break;
        case actionNames.OPEN_URL:
          // eventHandler = this.appendActionHandler(
          //   eventHandler,
          //   this.handleOpenUrl,
          //   actionData[i].actionProcess
          // );
          actionsList.push({
            handler: this.handleOpenUrl,
            data: actionData[i].actionProcess
          });
          break;
        default:
          break;
      }
    }
    return this.createEventHandler(actionsList);
    // return eventHandler;
  }

  /**
   * Function to compose multiple function calls together.
   * Used to support multiple actions on a single element (e.g. setValue + refresh)
   * Must use call() to ensure correct context at time of calling.
   * @param { func } curFunc - current composed function, to be added to
   * @param { func } newFunc - function to be appended onto curFunc
   * @param { Object } actionProcess - actionProcess data, returned from API for action.
   * @return { func } function of composed param functions
   */
  appendActionHandler(curFunc, newFunc, actionProcess = null) {
    return (e, data) => {
      curFunc.call(this, e, data);
      newFunc.call(this, e, data, actionProcess);
    };
  }

  /**
   * This is to check if the elem has both a set value and refresh.
   * Must handle simultaneous setValue + refresh carefully, as using setState to update the target
   * of setValue won't update the data before the POST.
   * Does not currently support multiple DIFFERENT setValue actions, but will support multiple
   * values that are set under a single action.
   * @param { Object } actionData - object of actionData attached to field.
   * @return { Object } setValueData if field has refresh AND setValue, null otherwise.
   */
  getDataForSetValueAndRefresh(actionData) {
    let hasRefresh = false;
    let hasSetValue = false;
    let setValueData = null;

    for (let i = 0; i < actionData.length; i++) {
      if (actionData[i].action === "setValue") {
        hasSetValue = true;
        setValueData = actionData[i].actionProcess;
      }

      if (actionData[i].action === "refresh") {
        hasRefresh = true;
      }
    }

    if (hasRefresh && hasSetValue) {
      return setValueData;
    }

    return null;
  }

  /**
   * Generic way to check over actionSets.
   * Returns all actions/events that match one of the targetActions.
   * Returns empty array if none found.
   * @param { Object } field - field object from the API
   * @param { Array } targetActions - array of strings, actions to target
   * @return { Array } array of target actions if found, otherwise empty array.
   */
  getActionData(field, targetActions) {
    let result = [];

    if (field.control && field.control.actionSets) {
      let actionSets = field.control.actionSets;

      for (let i = 0; i < actionSets.length; i++) {
        // If we see one of the target actions, return that action
        let actions = actionSets[i].actions;
        let events = actionSets[i].events;

        for (let j = 0; j < actions.length; j++) {
          if (
            targetActions.some(
              targetAction => targetAction === actions[j].action
            )
          ) {
            result.push({ ...actions[j], events: events });
          }
        }
      }
    }

    return result;
  }

  /**
   * Generic way to check over actionSets.
   * Returns the first action OR event that matches one of the targetActions or targetEvents.
   * Returns null if none found.
   * @param { Object } field - field object from the API
   * @param { Array } targetActions - array of strings, actions to target
   * @param { Array } targetEvents - array of strings, events to target
   * @return { Object } target action or event if found, otherwise null
   */
  actionSetChecker(field, targetActions, targetEvents) {
    if (field.control && field.control.actionSets) {
      let actionSets = field.control.actionSets;

      for (let i = 0; i < actionSets.length; i++) {
        // If we see one of the target actions, return that action
        let actions = actionSets[i].actions;
        for (let j = 0; j < actions.length; j++) {
          if (
            targetActions.some(
              targetAction => targetAction === actions[j].action
            )
          ) {
            return actions[j];
          }
        }

        // If we see one of the target event, return that event
        let events = actionSets[i].events;
        for (let j = 0; j < events.length; j++) {
          if (
            targetEvents.some(targetEvent => targetEvent === events[j].event)
          ) {
            return events[j];
          }
        }
      }
    }

    return null;
  }

  /**
   * Helper function to expand relative path to fully qualified path.
   * Needed for storing correct values on state, and POSTing values to server.
   * e.g. converts ".Address(1).FirstName" to "Address(1).FirstName"
   * @param { String } relPath - relative path to expand to full path
   */
  expandRelativePath(relPath) {
    if (relPath.charAt(0) === ".") {
      return relPath.substring(1);
    }

    return relPath;
  }

  /**
   * Helper function to translate Pega string / bool / property reference to desired value.
   * If we receiving a direct string value from Pega, it will be enclosed in quotes.
   * If we recieve a property reference path, we want the actual value of the property.
   * If we receive a number, we want numerical type, not a string.
   * If we receive a bool in string form, we want a bool returned.
   * e.g. "\"I am a sample string\"" yields "I am a sample string"
   *      OR true yields true
   *      OR ".FirstName" yields actual value of FirstName property
   * @param { String / Bool } property - desired property to get value of
   * @return { String / Int / Bool } value of property, depending on contents
   */
  getPropertyValue(property, valueReference) {
    // If the property is a bool, return it directly
    if (typeof property === "boolean") {
      return property;
    }
    let value;
    // If the property starts with a " character, then strip the quotes.
    if (property.charAt(0) === '"') {
      value = property.replace(/"/g, "");
    } else {
      // If the property starts with a . character, then convert it to full path and get its value
      //if (property.charAt(0) === ".") {
      value = this.state.values[this.expandRelativePath(property)];
      if (valueReference && !value) {
        if (valueReference.lastSavedValue) return valueReference.lastSavedValue;
        return null;
      }
      //}
    }

    // The property format was unhandled, return it directly
    if (!value) value = property;
    return value;
  }

  /**
   * This section includes functions that handle updating state for the PegaForm component.
   * Data is maintained on state on the PegaForm.
   */

  /**
   * Handle change for field. Update state correspondingly.
   * Can handle input, checkboxes, dropdowns, and date times.
   * @param { Object } e - synthetic event
   * @param { Object } data - form element that called handler
   * @param { Func } callback - callback to be called after setState completes
   */
  handleChange(e, obj, callback = null, field) {
    let value;
    let date = null;

    if (e && e._isAMomentObject) {
      // Handle date time
      // value = e.format("MM/DD/YYYY");
      value = e.format("YYYYMMDD");
      if (
        field &&
        field.control.modes.length > 0 &&
        field.control.modes[1].formatType
      ) {
        const formatType = field.control.modes[1].formatType;
        if (formatType.includes("datetime")) {
          value = value + "T000000.000";
        }
      }
      date = value;
    } else {
      // Handle inputs or checkboxes, but exclude radio buttons
      if (!obj.radio && obj.checked) {
        value = obj.checked;
      } else {
        e.target.classList.add("field");
        value = obj.value;
      }
    }

    let callbackFunc = null;
    if (callback) {
      e.persist();
      callbackFunc = () => callback(e, obj);
    }
    // Store new values
    this.setState(
      {
        values: {
          ...this.state.values,
          [obj.reference]: value
        },
        date: date ? moment(date) : this.state.date
      },
      callbackFunc
    );
  }

  /**
   * List Action Handler
   * @param { Object } e - synthetic event
   * @param { Object } data - form element that called handler
   */
  handleListActions(e, data) {
    e.preventDefault();

    this.setState({
      loadingElems: {
        ...this.state.loadingElems,
        [data.reference]: true
      }
    });

    let postContent = ReferenceHelper.getPostContent(this.state.values);
    let target = ReferenceHelper.getRepeatFromReference(
      data.reference,
      data.referencetype,
      postContent
    );

    switch (data.action) {
      case "add":
        target.push(ReferenceHelper.getBlankRowForRepeat(target));
        break;
      case "remove":
        if (target.length > 1) {
          target.pop();
        }
        break;
      default:
        break;
    }

    this.props
      .dispatch(
        assignmentActions.performRefreshOnAssignment(
          this.props.caseID,
          this.props.assignment.ID,
          this.props.currAssignmentAction,
          postContent
        )
      )
      .then(() => {
        this.setState({
          loadingElems: {
            ...this.state.loadingElems,
            [data.reference]: false
          }
        });
      });
  }

  /**
   * PageGroup action handler
   * @param { Object } e - synthetic event
   * @param { Object } data - form element that called handler
   */
  handleGroupActions(e, data) {
    e.preventDefault();

    let isRemove = data.action === "remove";
    let postContent = ReferenceHelper.getPostContent(this.state.values);
    let target = ReferenceHelper.getRepeatFromReference(
      data.reference,
      data.referencetype,
      postContent
    );

    const name = isRemove
      ? prompt("Please enter the name of the group to be deleted.")
      : prompt("Please enter a name for the group.", "");

    if (name === null) {
      return;
    }

    if (isRemove) {
      delete target[name];
    } else {
      target[name] = {};
    }

    this.props
      .dispatch(
        assignmentActions.performRefreshOnAssignment(
          this.props.caseID,
          this.props.assignment.ID,
          this.props.currAssignmentAction,
          postContent
        )
      )
      .then(() => {
        this.setState({
          loadingElems: {
            ...this.state.loadingElems,
            [data.reference]: false
          }
        });
      });
  }

  /**
   * Set datepicker focused
   * @param { Bool } focused - is date picker focused
   */
  focusDatePicker(focused, field) {
    let datePickerFocused = { ...this.state.datePickerFocused };
    datePickerFocused[field.fieldID] = focused;
    this.setState({ datePickerFocused });
  }

  /**
   * This section handle actions attached to fields.
   *
   */

  /**
   * Method to handle field refresh. This is only triggered when we want to
   * send data to the server.
   * In the event that there are setValues connected to this refresh, we must directly
   * set those values in this method.
   * @param { Object } e - synthetic event
   * @param { Object } data - data representing the field that is triggering refresh
   * @param { Object } actionProcess - object with information about setValuePairs, if needed
   */
  handleFieldRefresh(e, data, actionProcess, refreshForData) {
    if (!this.props.assignment) {
      return;
    }

    let postContent = ReferenceHelper.getPostContent(this.state.values);
    // If we have setValues connected to this refresh, ensure the values are set before the POST
    // This is needed because setState is async, and calling it would not update the values in time
    if (actionProcess && actionProcess.setValuePairs) {
      actionProcess.setValuePairs.forEach(pair => {
        // The paths attached to setvaluepairs include relative references.
        // Must make them absolute to be handled by ReferenceHelper.addEntry()
        let val;
        if (pair.valueReference) {
          val = this.getPropertyValue(pair.valueReference.reference);
          if (!val) val = pair.valueReference.lastSavedValue;
          ReferenceHelper.addEntry(
            this.expandRelativePath(pair.name),
            val,
            postContent
          );
        } else {
          let fullPath = this.expandRelativePath(pair.name);
          val = this.getPropertyValue(pair.value);
          ReferenceHelper.addEntry(fullPath, val, postContent);
        }
      });
    }

    if (refreshForData && refreshForData.refreshFor) {
      ReferenceHelper.addEntry(
        "refreshFor",
        refreshForData.refreshFor,
        postContent
      );
    }

    return this.props.dispatch(
      assignmentActions.performRefreshOnAssignment(
        this.props.caseID,
        this.props.assignment.ID,
        this.props.currAssignmentAction,
        postContent
      )
    );
  }

  /**
   * Method to handle setValue for fields. This is only triggered when a setValue event
   * is found WITHOUT a refresh (which would POST the value).
   * setValue with refresh must happen simultaneously via handleFieldRefresh, as setState is async.
   * @param { Object } e - synthetic event
   * @param { Object } data - data representing the field that was blurred
   * @param { Object } actionProcess - object with information about setValuePairs
   */
  handleSetValue(e, data, actionProcess) {
    let newValues = Object.assign({}, this.state.values);

    actionProcess.setValuePairs.forEach(pair => {
      // The paths attached to setvaluepairs include relative references.
      // Must make them absolute to be handled by ReferenceHelper.addEntry()
      if (pair.valueReference) {
        let val = this.getPropertyValue(pair.valueReference.reference);
        if (!val) val = pair.valueReference.lastSavedValue;
        ReferenceHelper.addEntry(
          this.expandRelativePath(pair.valueReference.reference),
          val,
          newValues
        );
      } else {
        newValues[this.expandRelativePath(pair.name)] = this.getPropertyValue(
          pair.value
        );
      }
    });

    this.setState({
      values: newValues
    });
  }

  sanitizeHTML(value) {
    const doc = new DOMParser().parseFromString(value, "text/html");
    const val = doc.documentElement.textContent;
    return val;
  }

  /**
   * Method to handle PerformAction action. This is triggered when the event is seen.
   * @param { Object } e - synthetic event
   * @param { Object } data - data represneting the field that the perform action was triggered on
   * @param { Object } actionProcess - object with information about performAction
   */
  handlePerformAction(e, data, actionProcess) {
    this.props.updateCurrAssignmentAction(actionProcess.actionName);

    return this.props.dispatch(
      assignmentActions.getFieldsForAssignment(
        this.props.assignment,
        actionProcess.actionName
      )
    );
  }

  /**
   * Method to handle RunScript action. This is triggered when the event is seen.
   * @param { Object } e - synthetic event
   * @param { Object } data - data representing the field that the perform action was triggered on
   * @param { Object } actionProcess - object with information about script to run
   */
  handleRunScript(e, data, actionProcess) {
    let evalString = actionProcess.functionName + "(";

    if (actionProcess.functionParameters) {
      let paramString = actionProcess.functionParameters
        .map(param => {
          // let val = this.state.values[this.expandRelativePath(param.value)];
          let val;
          if (param.valueReference) {
            val = this.getPropertyValue(
              param.valueReference.reference,
              param.valueReference
            );
            if (!val) val = param.valueReference.lastSavedValue;
          } else {
            val = this.getPropertyValue(param.value);
          }

          if (val === undefined || val === null) {
            val = "null";
          } else if (typeof val === "string") {
            val = `"${val}"`;
          }

          return val;
        }, this)
        .join(", ");

      evalString += paramString;
    }

    evalString += ");";
    eval(evalString);
  }

  /**
   * Method to handle OpenURL action. This is triggered when the event is seen.
   * @param { Object } e - synthetic event
   * @param { Object } data - data representing the field that the perform action was triggered on
   * @param { Object } actionProcess - object with information about url to open
   */
  handleOpenUrl(e, data, actionProcess) {
    let url;

    if (actionProcess.alternateDomain) {
      url = actionProcess.alternateDomain.url;
      if (!url && actionProcess.alternateDomain.urlReference)
        url = this.getPropertyValue(
          actionProcess.alternateDomain.urlReference.reference,
          actionProcess.alternateDomain.urlReference
        );
      if (!url) {
        url = actionProcess.alternateDomain.urlReference.lastSavedValue;
      }
    }

    if (url.indexOf("http") !== 0) {
      url = "http://" + url.replace(/"/g, "");
    }

    let queryParams = actionProcess.queryParams
      .map(param => {
        let parmValue;
        if (param.value) parmValue = param.value;
        else if (param.valueReference.reference)
          parmValue = this.getPropertyValue(
            param.valueReference.reference,
            param.valueReference
          );
        if (!parmValue) parmValue = param.valueReference.lastSavedValue;
        return `${param.name}=${parmValue}`.replace(/"/g, "");
      })
      .join("&");

    if (queryParams) url += "?" + queryParams;
    window.open(url, actionProcess.windowName, actionProcess.windowOptions);
  }

  /**
   * Handle submit for the form
   * Dispatch action to perform action on assignment, with state stored on Work Object.
   */
  handleSubmit(e) {
    const { assignment } = this.props;

    let newValues = Object.assign({}, this.state.values);

    this.props
      .dispatch(
        assignmentActions.performActionOnAssignment(
          this.props.caseID,
          assignment.ID,
          this.props.currAssignmentAction,
          newValues
        )
      )
      .then(action => {
        // This is to handle the case that we are changing actions on the same assignment
        if (
          action.assignment &&
          action.assignment.nextAssignmentID === assignment.ID
        ) {
          this.props.updateCurrAssignmentAction(action.nextActionID);
        }
      });
  }

  /**
   * Handle cancel for the form. Closes the work object.
   * @param { Object } e - synthetic event
   * @param { Object } data
   */
  handleCancel(e, data) {
    e.preventDefault();
    this.props.dispatch(errorActions.clearErrors(this.props.caseID));
    this.props.dispatch(assignmentActions.closeAssignment(this.props.caseID));
  }

  /**
   * Handle save for the form. Does not close the work object.
   * @param { Object } e - synthetic event
   * @param { Object } data
   */
  handleSave(e, data) {
    e.preventDefault();

    let newValues = Object.assign({}, this.state.values);
    this.props.dispatch(
      caseActions.updateCase(this.props.caseID, newValues, this.props.etag)
    );
  }

  /**
   * Handle case create when using New harness.
   * Dispatch action to perform case creation.
   */
  handleCaseCreate() {
    let postContent = ReferenceHelper.getPostContent(this.state.values);

    this.props.dispatch(caseActions.createCase(this.props.caseID, postContent));
  }

  /**
   * Returns an object with validation errors associated to field references.
   * @param { Object } errors - object returned from API with errors
   * @return { Object } object with validation errors associated with reference keys
   */
  getValidationErrorsByKey(errors) {
    let errorsByKey = {};

    if (errors) {
      errors.ValidationMessages.forEach(message => {
        if (message.Path) {
          errorsByKey[this.expandRelativePath(message.Path)] =
            message.ValidationMessage;
        }
      });
    }

    return errorsByKey;
  }

  render() {
    // If we are showing New harness, then do not show caseView, only harness.
    if (this.props.page && this.props.page.name === pageNames.NEW) {
      return this.getPage();
    }

    // In the event that we have a page, show it instead of the form
    // This is used for things like the "Confirm" harness.
    // Also show caseView on the right side of the WorkObject.
    return (
      <Grid columns={2} stackable as={Segment} attached="bottom">
        <Grid.Row>
          <Grid.Column width={10}>
            {this.props.page ? this.getPage() : this.getForm()}
          </Grid.Column>
          <Grid.Column width={6}>{this.getCaseView()}</Grid.Column>
        </Grid.Row>
      </Grid>
    );
  }
}

function mapStateToProps(state) {
  const caseDetail = {
    ...state.cases.caseDetails[state.assignments.openAssignmentsTabIdx[0]]
  };
  const { openCasesData } = { ...state.assignments };
  return {
    openCasesData,
    caseDetail
  };
}

const connectedPegaForm = connect(mapStateToProps)(PegaForm);
export { connectedPegaForm as PegaForm };
