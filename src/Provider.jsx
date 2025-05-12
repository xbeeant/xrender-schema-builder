import { ConfigProvider } from 'antd';
import zhCN from 'antd/lib/locale/zh_CN';
import copyTOClipboard from 'copy-text-to-clipboard';

import {
  mapping as defaultMapping,
  Input ,
InputNumber ,
TextArea ,
Select ,
MultiSelect ,
Switch ,
Radio ,
Rate ,
TreeSelect ,
Checkbox ,
Checkboxes ,
Color ,
DatePicker ,
DateRange ,
TimePicker ,
TimeRange ,
ImageInput ,
UrlInput ,
Slider ,
Upload ,
Html ,
PercentSlider ,
Card ,
Collapse ,
SubInline ,
LineTitle ,
SimpleList ,
CardList ,
TableList ,
DrawerList ,
VirtualList ,
TabList ,
VoidTitle ,
ErrorSchema 
} from 'form-render';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { fromSetting, toSetting } from './transformer/form-render';
import {
  combineSchema,
  dataToFlatten,
  defaultGetId,
  flattenSchema,
  flattenToData,
  idToSchema,
  newSchemaToOld,
  schemaToState,
} from './utils';
import { Ctx, StoreCtx } from './utils/context';
import { useSet } from './utils/hooks';
import { serializeToDraft } from './utils/serialize';
import list from './widgets/list';

const DEFAULT_SCHEMA = {
  type: 'object',
  properties: {},
};

const defaultWidgets = {
  input : Input ,
  inputNumber : InputNumber ,
  textArea : TextArea ,
  select : Select ,
  multiSelect : MultiSelect ,
  switch : Switch ,
  radio : Radio ,
  rate : Rate ,
  treeSelect : TreeSelect ,
  checkbox : Checkbox ,
  checkboxes : Checkboxes ,
  color : Color ,
  datePicker : DatePicker ,
  dateRange : DateRange ,
  timePicker : TimePicker ,
  timeRange : TimeRange ,
  imageInput : ImageInput ,
  urlInput : UrlInput ,
  slider : Slider ,
  upload : Upload ,
  html : Html ,
  percentSlider : PercentSlider ,
  card : Card ,
  collapse : Collapse ,
  subInline : SubInline ,
  lineTitle : LineTitle ,
  simpleList : SimpleList ,
  cardList : CardList ,
  tableList : TableList ,
  drawerList : DrawerList ,
  virtualList : VirtualList ,
  tabList : TabList ,
  voidTitle : VoidTitle ,
  errorSchema : ErrorSchema 
}

// TODO: formData 不存在的时候会报错：can't find # of undefined
function Provider(props, ref) {
  const {
    defaultValue,
    canDrag,
    canDelete,
    submit,
    transformer: _transformer,
    extraButtons,
    controlButtons,
    preview: _preview,
    hideId,
    getId = defaultGetId,
    settings,
    commonSettings,
    globalSettings,
    widgets = {},
    mapping = {},
    methods = {},
    configProvider = {},
    validation = true,
    children,
    fieldRender,
    fieldWrapperRender,
    elementRender,
    prefixCls,
    onSelectItemCopy,
  } = props;

  const transformer = {
    from: schema => schema,
    to: schema => schema,
    fromSetting,
    toSetting,
    ..._transformer,
  };
  const defaultRef = useRef();
  const frwRef = ref || defaultRef;
  const [state, setState] = useSet({
    formData: {},
    frProps: {}, // form-render 的全局 props 等
    isNewVersion: true, // 用schema字段，还是用propsSchema字段，这是一个问题
    preview: false, // preview = false 是编辑模式
    schema: {},
    selected: undefined, // 被选中的$id, 如果object/array的内部，以首字母0标识
    settingsForm: null,
  });
  const [errorFields, setErrorFields] = useState([]);

  // 收口点 propsSchema 到 schema 的转换 (一共3处，其他两个是 importSchema 和 setValue，在 FRWrapper 文件)
  useEffect(() => {
    const schema = defaultValue
      ? transformer.from(defaultValue)
      : DEFAULT_SCHEMA;
    if (schema) setState(schemaToState(schema));
  }, [defaultValue]);

  const { formData, frProps, isNewVersion, preview, schema, selected } = state;

  const onChange = data => {
    setState({ formData: data });
    props.onChange && props.onChange(data);
  };

  const onSchemaChange = newSchema => {
    setState({ schema: newSchema });
    if (props.onSchemaChange) {
      setTimeout(() => {
        if (!frwRef.current) return;
        const pureSchema = frwRef.current.getValue();
        props.onSchemaChange(pureSchema);
      }, 0);
    }
  };

  const _mapping = { ...defaultMapping, ...mapping };
  const _widgets = { ...defaultWidgets, ...widgets, list };

  const rootState = {
    preview: _preview ?? preview,
    mapping: _mapping,
    widgets: _widgets,
    methods,
    selected,
  };

  const userProps = {
    canDrag,
    canDelete,
    submit,
    transformer,
    isNewVersion,
    extraButtons,
    controlButtons,
    hideId,
    getId,
    validation,
    settings,
    commonSettings,
    globalSettings,
  };

  let _schema = {};
  if (schema) {
    _schema = combineSchema({ ...schema, ...frProps }); // TODO: 要不要判断是否都是object
  }
  const flatten = flattenSchema(_schema);
  const flattenWithData = transformer.from(dataToFlatten(flatten, formData));

  const onFlattenChange = (newFlatten, changeSource = 'schema') => {
    const newSchema = idToSchema(newFlatten);
    const newData = flattenToData(newFlatten);
    // 判断只有schema变化时才调用，一般需求的用户不需要
    if (changeSource === 'schema') {
      onSchemaChange(newSchema);
    }
    // schema 变化大都会触发 data 变化
    onChange(newData);
  };

  const onItemChange = (key, value, changeSource) => {
    flattenWithData[key] = value;
    onFlattenChange(flattenWithData, changeSource);
  };

  let displaySchema = {};
  let displaySchemaString = '';
  try {
    const _schema = {
      ...idToSchema(flattenWithData, '#', true),
      ...frProps,
    };
    displaySchema = transformer.to(_schema);
    if (!isNewVersion) {
      displaySchema = newSchemaToOld(displaySchema);
    }
    // displaySchemaString = JSON.stringify(displaySchema, null, 2);
    // 支持直接保存函数之后(解决validtor不能正常保存的问题)，这里因为导入导出的问题，序列化也用内置的api序列化
    displaySchemaString = serializeToDraft(displaySchema);
  } catch (error) {}

  const getValue = () => displaySchema;

  const setValue = value => {
    try {
      setState(state => ({
        ...state,
        selected: undefined,
        ...schemaToState(transformer.from(value)),
      }));
    } catch (error) {
      console.error(error);
    }
  };

  const copyValue = () => {
    copyTOClipboard(displaySchemaString);
  };

  const getErrorFields = () => errorFields;

  const getSettingsForm = () => state.settingsForm;

  useImperativeHandle(frwRef, () => ({
    getValue,
    setValue,
    copyValue,
    getErrorFields,
    getSettingsForm,
  }));

  // TODO: flatten是频繁在变的，应该和其他两个函数分开
  const store = {
    flatten: flattenWithData, // schema + formData = flattenWithData
    onFlattenChange, // onChange + onSchemaChange = onFlattenChange
    onItemChange, // onFlattenChange 里只改一个item的flatten，使用这个方法
    onSchemaChange,
    onChange,
    errorFields,
    onItemErrorChange: setErrorFields,
    onSelectItemCopy,
    userProps,
    frProps,
    displaySchema,
    displaySchemaString,
    fieldRender,
    fieldWrapperRender,
    elementRender,
    ...rootState,
  };

  return (
    <DndProvider backend={HTML5Backend} context={window}>
      <ConfigProvider locale={zhCN} {...configProvider}>
        <Ctx.Provider value={setState}>
          <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>
        </Ctx.Provider>
      </ConfigProvider>
    </DndProvider>
  );
}

export default forwardRef(Provider);
